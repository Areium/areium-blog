# 深入 vLLM：高吞吐 LLM 推理系统的解剖

**从 paged attention、continuous batching、prefix caching、specdec 等，到多 GPU、多节点的大规模动态服务**

> 原文：*Inside vLLM: Anatomy of a High-Throughput LLM Inference System*，作者 Aleksa Gordic，2025 年 9 月 5 日。
> 原文链接：<https://vllm.ai/blog/2025-09-05-anatomy-of-vllm>

> **注：** 本文最初发表于 [Aleksa Gordic 的个人网站](https://www.aleksagordic.com/blog/vllm)。

在本文中，我会逐步介绍构成一个现代高吞吐 LLM 推理系统的全部核心系统组件与高级特性。具体来说，我会拆解 vLLM[\[1\]](#ref-1) 是如何工作的。

这是系列文章的第一篇。它先讲全局，再层层深入（采用倒金字塔式的写法），让你在不被细枝末节淹没的前提下，对整个系统建立起准确的高层心智模型。

后续文章会深入具体的子系统。

全文分为五个部分：

1. **LLM engine 与 engine core**：vLLM 的基础（调度、paged attention、continuous batching 等）
2. **高级特性**：chunked prefill、prefix caching、guided decoding 与 speculative decoding、P/D 分离
3. **向上扩展**：从单 GPU 到多 GPU 执行
4. **服务层**：分布式 / 并发的 Web 骨架
5. **基准测试与自动调优**：度量延迟与吞吐

> **注：**
> * 分析基于 [commit 42172ad](https://github.com/vllm-project/vllm/tree/42172ad)（2025 年 8 月 9 日）。
> * 目标读者：所有好奇最前沿 LLM 引擎如何工作的人，以及有兴趣为 vLLM、SGLang 等项目贡献代码的人。
> * 我会聚焦 [V1 引擎](https://docs.vllm.ai/en/latest/usage/v1_guide.html)。我也研究过 V0（现已[废弃](https://github.com/vllm-project/vllm/issues/18571)），这对理解项目如何演进很有价值，而且很多概念至今仍然适用。
> * 第一节关于 LLM Engine / Engine Core 的内容可能有点令人窒息、略显枯燥——但本文后面有大量示例和图示 :)

## LLM Engine 与 Engine Core

LLM engine 是 vLLM 最基本的构建单元。它本身就已经能实现高吞吐推理——但仅限于离线场景。你还没法通过 Web 把它作为服务提供给客户。

我们用下面这段离线推理代码作为贯穿全文的示例（改编自 [basic.py](https://github.com/vllm-project/vllm/blob/main/examples/offline_inference/basic/basic.py)）。

```python
from vllm import LLM, SamplingParams

prompts = [
    "Hello, my name is",
    "The president of the United States is",
]

sampling_params = SamplingParams(temperature=0.8, top_p=0.95)

def main():
    llm = LLM(model="TinyLlama/TinyLlama-1.1B-Chat-v1.0")

    outputs = llm.generate(prompts, sampling_params)

if __name__ == "__main__":
    main()
```

> **注：** 环境变量：
>
> * `VLLM_USE_V1="1"` # 我们使用 V1 引擎
> * `VLLM_ENABLE_V1_MULTIPROCESSING="0"` # 我们在单进程中运行

这个配置是：

* 离线的（没有 Web / 分布式系统骨架）
* 同步的（所有执行都发生在一个阻塞进程中）
* 单 GPU 的（没有数据 / 模型 / 流水线 / 专家并行；DP/TP/PP/EP = 1）
* 使用标准 transformer[\[2\]](#ref-2)（要支持 Jamba 这类混合模型，需要更复杂的混合 KV cache 内存分配器）

从这里出发，我们会逐步构建出一个在线、异步、多 GPU、多节点的推理系统——但仍然只服务标准 transformer。

在这个示例里我们做两件事：

1. 实例化一个引擎
2. 在它上面调用 `generate`，从给定的 prompt 中采样

我们先来分析构造函数。

### LLM Engine 构造函数

引擎的主要组件是：

* vLLM config（包含用于配置模型、缓存、并行度等的所有旋钮）
* processor（通过校验、分词和处理，把原始输入变成 `EngineCoreRequests`）
* engine core client（在我们的示例里用的是 `InprocClient`，它基本上等同于 `EngineCore`；我们会逐步过渡到 `DPLBAsyncMPClient`，它支持大规模服务）
* output processor（把原始的 `EngineCoreOutputs` 转换成用户看到的 `RequestOutput`）

> **注：** 随着 V0 引擎被废弃，类名和细节可能会变化。我会强调核心思想，而不是精确的函数签名。这些细节中有一部分我会抽象掉，但不是全部。

Engine core 本身由几个子组件构成：

* Model Executor（驱动模型的前向计算，目前我们处理的是 `UniProcExecutor`，它在单张 GPU 上只有一个 `Worker` 进程）。我们会逐步过渡到支持多 GPU 的 `MultiProcExecutor`
* Structured Output Manager（用于 guided decoding——后面会讲）
* Scheduler（决定哪些请求进入下一个 engine step），它进一步包含：
  1. 策略设置——可以是 **FCFS**（先到先服务）或 **priority**（优先级高的请求先服务）
  2. `waiting` 与 `running` 队列
  3. KV cache manager——paged attention 的心脏[\[3\]](#ref-3)

KV cache manager 维护一个 `free_block_queue`——一个可用 KV cache block 的池子（数量常常在几十万量级，取决于显存大小和 block size）。在 paged attention 中，这些 block 充当索引结构，把 token 映射到它们已经计算好的 KV cache block。

![图 1](https://vllm.ai/blog-assets/figures/2025-vllm-anatomy/engine_constructor.png)

**图 1**：本节描述的核心组件及其关系

> **注：** 标准 transformer 层（非 MLA[\[4\]](#ref-4)）的 block size 计算方式如下：2（key/value）× `block_size`（默认 16）× `num_kv_heads` × `head_size` × `dtype_num_bytes`（例如 bf16 为 2）

在构造 model executor 的过程中，会创建一个 `Worker` 对象，并执行三个关键过程。（之后换成 `MultiProcExecutor` 时，这些相同的过程会在不同 GPU 上的每个 worker 进程中独立执行。）

1. 初始化设备：
   * 给 worker 分配一个 CUDA 设备（例如 "cuda:0"），并检查模型 dtype 是否受支持（例如 bf16）
   * 根据请求的 `gpu_memory_utilization`（例如 0.8 → 总显存的 80%）确认显存是否足够
   * 设置分布式配置（DP / TP / PP / EP 等）
   * 实例化 `model_runner`（持有 sampler、KV cache，以及 `input_ids`、`positions` 等前向传播缓冲区）
   * 实例化 `InputBatch` 对象（持有 CPU 侧的前向传播缓冲区、用于 KV cache 索引的 block table、采样元数据等）

2. 加载模型：
   * 实例化模型架构
   * 加载模型权重
   * 调用 `model.eval()`（PyTorch 的推理模式）
   * 可选：对模型调用 `torch.compile()`

3. 初始化 KV cache：
   * 获取每一层的 KV cache spec。历史上这永远是 `FullAttentionSpec`（同构 transformer），但混合模型（滑动窗口、像 Jamba 这样的 Transformer/SSM 混合）让情况变复杂了（参见 Jenga[\[5\]](#ref-5)）
   * 跑一次 dummy / profiling 前向计算，并对 GPU 内存做快照，计算可用显存能容纳多少个 KV cache block
   * 分配、reshape 并把 KV cache 张量绑定到注意力层
   * 准备注意力元数据（例如把后端设为 FlashAttention），供前向传播时 kernel 使用
   * 除非传入 `--enforce-eager`，否则对每个 warmup batch size 各跑一次 dummy 运行并捕获 CUDA graph。CUDA graph 把整个 GPU 工作序列记录成一个 DAG。之后前向传播时，我们启动 / 重放预先烘焙好的图，从而削减 kernel launch 开销、改善延迟

我在这里抽象掉了许多底层细节——但这些是我接下来会介绍的核心部分，因为后面的章节会反复引用它们。

现在引擎已经初始化好了，我们继续看 `generate` 函数。

### Generate 函数

第一步是校验请求并把它们喂进引擎。对每个 prompt，我们会：

1. 创建一个唯一的 request ID，并记录它的到达时间
2. 调用输入预处理器，对 prompt 分词，返回一个包含 `prompt`、`prompt_token_ids` 和 `type`（text、tokens、embeds 等）的字典
3. 把这些信息打包成 `EngineCoreRequest`，并加上优先级、采样参数和其他元数据
4. 把请求传给 engine core，后者把它包装成 `Request` 对象，把状态设为 `WAITING`。随后这个请求被加入调度器的 `waiting` 队列（FCFS 用 append，priority 用 heap-push）

此时引擎已经喂饱，可以开始执行了。在同步引擎的示例里，这些初始 prompt 就是我们会处理的全部请求——没有在运行中途注入新请求的机制。相比之下，异步引擎支持这一点（也就是 **continuous batching**[\[6\]](#ref-6)）：每一步之后，新请求和老请求都会被考虑。

由于前向传播把整个 batch 拉平成一个序列，并由自定义 kernel 高效处理，所以即使在同步引擎里，continuous batching 在根本上也是被支持的。

接下来，只要还有请求要处理，引擎就会反复调用它的 `step()` 函数。每个 step 有三个阶段：

1. 调度：选出这一步要运行哪些请求（decode 和/或（分块的）prefill）
2. 前向传播：运行模型并采样 token
3. 后处理：把采样到的 token ID 追加到每个 `Request`，做 detokenize，并检查停止条件。如果请求已完成，就进行清理（例如把它的 KV cache block 归还给 `free_block_queue`），并提前返回输出

> **注：** 停止条件是：
>
> * 请求超过其长度上限（`max_model_length` 或它自己的 `max_tokens`）
> * 采样到的 token 是 EOS ID（除非启用了 `ignore_eos`——当我们在基准测试中想强制生成一定数量的输出 token 时很有用）
> * 采样到的 token 命中采样参数中指定的任一 `stop_token_ids`
> * 输出中出现了停止字符串（stop strings）——我们会把输出截断到第一次出现停止字符串的位置，并在引擎中中止该请求（注意 `stop_token_ids` 会出现在输出里，但停止字符串不会）

![图 2](https://vllm.ai/blog-assets/figures/2025-vllm-anatomy/engine_loop.png)

**图 2**：引擎循环

> **注：** 在流式模式下，我们会随着 token 生成把它们逐个发送出去，但这里先忽略这一点。

接下来，我们更仔细地看调度。

### 调度器

推理引擎处理两类主要负载：

1. **Prefill** 请求——对所有 prompt token 做一次前向传播。这类通常是**计算受限（compute-bound）**的（阈值取决于硬件和 prompt 长度）。结束时，我们从最后一个 token 位置的概率分布中采样出一个 token。
2. **Decode** 请求——只对最近一个 token 做前向传播。此前所有的 KV 向量都已经缓存。这类是**显存带宽受限（memory-bandwidth-bound）**的，因为要计算一个 token，我们仍然需要加载所有 LLM 权重（以及 KV cache）。

在基准测试一节中，我们会分析所谓的 GPU 性能 roofline 模型。它会更详细地解释 prefill / decode 性能画像背后的原因。

得益于更聪明的设计选择，V1 调度器可以在同一个 step 里混合这两类请求。相比之下，V0 引擎一次只能处理 prefill 或 decode 中的一种。

调度器优先处理 decode 请求——也就是已经在 `running` 队列里的那些。对每个这样的请求，它会：

1. 计算要生成的新 token 数量（不总是 1，因为 speculative decoding 和异步调度——后面会详细讲）
2. 调用 KV cache manager 的 `allocate_slots` 函数（细节见下）
3. 用第 1 步的 token 数量更新 token 预算（做减法）

之后，它处理 `waiting` 队列里的 prefill 请求：

1. 获取已计算的 block 数量（如果 prefix caching 关闭则返回 0——后面会讲）
2. 调用 KV cache manager 的 `allocate_slots` 函数
3. 把请求从 waiting 弹出并移入 running，把状态设为 `RUNNING`
4. 更新 token 预算

现在我们来看看 `allocate_slots` 做什么：

1. **计算 block 数量**——确定必须分配多少个新的 KV cache block（`n`）。默认每个 block 存 16 个 token。例如，一个 prefill 请求有 17 个新 token，就需要 `ceil(17/16) = 2` 个 block。
2. **检查可用性**——如果 manager 池子里的 block 不够，就提前退出。根据请求是 decode 还是 prefill，引擎可能会尝试 recompute 抢占（swap 抢占在 V0 中支持过），即驱逐低优先级请求（调用 `kv_cache_manager.free`，把 KV block 归还 block 池），或者跳过调度、继续执行。
3. **分配 block**——通过 KV cache manager 的 coordinator，从 block 池（前面提到的 `free_block_queue` 双向链表）中取出前 `n` 个 block。存入 `req_to_blocks`，这是一个把每个 `request_id` 映射到其 KV cache block 列表的字典。

![图 3](https://vllm.ai/blog-assets/figures/2025-vllm-anatomy/kv_cache_blocks.png)

**图 3**：KV cache block 列表

我们终于准备好做一次前向传播了！

### 运行前向传播

我们调用 model executor 的 `execute_model`，它委托给 `Worker`，`Worker` 再委托给 model runner。

主要步骤如下：

1. **更新状态**——从 `input_batch` 中剔除已完成的请求；更新与前向传播相关的杂项元数据（例如每个请求的 KV cache block，用于索引 paged KV cache 内存）。
2. **准备输入**——把缓冲区从 CPU 拷贝到 GPU；计算 positions；构建 `slot_mapping`（示例中会详细讲）；构造注意力元数据。
3. **前向传播**——用自定义的 paged attn kernel 运行模型。所有序列被拉平、拼接成一条很长的「超级序列」。位置索引和注意力掩码保证每个序列只关注自己的 token，这使得 continuous batching 无需右侧 padding 即可实现。
4. **收集末位 token 状态**——提取每个序列最后一个位置的 hidden state，并计算 logits。
5. **采样**——按照采样配置（greedy、temperature、top-p、top-k 等）从计算出的 logits 中采样 token。

前向传播这一步本身有两种执行模式：

1. **Eager 模式**——在启用 eager 执行时，跑标准的 PyTorch 前向传播。
2. **「Captured」模式**——当没有强制 eager 时，执行 / 重放预先捕获的 CUDA Graph（还记得我们在引擎构造时、初始化 KV cache 的过程中捕获了这些图吗）。

下面这个具体示例应该能把 continuous batching 和 paged attention 讲清楚：

![图 4](https://vllm.ai/blog-assets/figures/2025-vllm-anatomy/fwd_pass.png)

**图 4**：前向传播：continuous batching 与 paged attention

## 高级特性——扩展核心引擎逻辑

基本引擎流程就位之后，我们来看看高级特性。

我们已经讨论过抢占（preemption）、paged attention 和 continuous batching。

接下来我们深入：

1. Chunked prefill
2. Prefix caching
3. Guided decoding（通过文法约束的有限状态机）
4. Speculative decoding
5. Disaggregated P/D（prefill/decoding 分离）

### Chunked prefill

chunked prefill 是一种处理长 prompt 的技术：把它们的 prefill 步骤切分成更小的块。没有它，一个超长请求可能会独占一个 engine step，让其他 prefill 请求无法运行。这会推迟其他所有请求，并增加它们的延迟。

例如，设每个 chunk 包含 `n`（=8）个 token，用小写字母标记、用「-」分隔。一个长 prompt `P` 可能形如 `x-y-z`，其中 `z` 是一个不完整的 chunk（例如 2 个 token）。那么为 `P` 执行完整的 prefill 将需要 ≥ 3 个 engine step（出现 > 的情况，可能是因为它在某个 step 中没有被调度执行），并且只有在最后一个分块 prefill step 中，我们才会采样出一个新 token。

同样的例子可视化如下：

![图 5](https://vllm.ai/blog-assets/figures/2025-vllm-anatomy/chunked_pt1.png)

**图 5**：Chunked prefill

实现很直接：给每个 step 的新 token 数设上限。如果请求的数量超过 `long_prefill_token_threshold`，就把它重置为恰好这个值。剩下的交给底层索引逻辑（前面描述过）。

在 vLLM V1 中，把 `long_prefill_token_threshold` 设成正整数即可启用 chunked prefill。（严格来说，即使不设置它也可能发生：如果 prompt 长度超过 token 预算，我们会截断它并运行一次 chunked prefill。）

### Prefix Caching

为了解释 prefix caching 的工作原理，我们把最初的代码示例稍作调整：

```python
from vllm import LLM, SamplingParams

long_prefix = "<a piece of text that is encoded into more than block_size tokens>"

prompts = [
    "Hello, my name is",
    "The president of the United States is",
]

sampling_params = SamplingParams(temperature=0.8, top_p=0.95)

def main():
    llm = LLM(model="TinyLlama/TinyLlama-1.1B-Chat-v1.0")

    outputs = llm.generate(long_prefix + prompts[0], sampling_params)
    outputs = llm.generate(long_prefix + prompts[1], sampling_params)

if __name__ == "__main__":
    main()
```

Prefix caching 避免重复计算多个 prompt 在开头共享的 token——所以叫**前缀**（prefix）。

关键在于 `long_prefix`：它被定义为任何长于一个 KV cache block（默认 16 个 token）的前缀。为简化示例，假设 `long_prefix` 的长度恰好是 `n × block_size`（其中 `n ≥ 1`）。

> **注：** 也就是说，它与 block 边界完美对齐——否则我们就得重算 `long_prefix_len % block_size` 个 token，因为不完整的 block 无法被缓存。

没有 prefix caching 时，每处理一个带有相同 `long_prefix` 的新请求，我们都要重算全部 `n × block_size` 个 token。

有了 prefix caching，这些 token 只计算一次（它们的 KV 存储在 KV cache paged 内存中），之后被复用，于是只有新的 prompt token 需要处理。这能加速 prefill 请求（不过对 decode 没有帮助）。

这在 vLLM 中是如何实现的？

在第一次 `generate` 调用期间，在调度阶段，`kv_cache_manager.get_computed_blocks` 内部会调用 `hash_request_tokens`：

1. 该函数把 `long_prefix + prompts[0]` 切分成 16 个 token 一块。
2. 对每个完整的 chunk，计算一个哈希（使用内置 hash 或 SHA-256，后者更慢但碰撞更少）。哈希把前一个 block 的哈希、当前 token 以及可选元数据组合在一起。

> **注：** 可选元数据包括：多模态（MM）哈希、LoRA ID、cache salt（注入第一个 block 的哈希，确保只有携带该 cache salt 的请求才能复用这些 block）。

3. 每个结果都存储为一个 `BlockHash` 对象，包含哈希及其 token ID。我们返回一个 block 哈希列表。

该列表存储在 `self.req_to_block_hashes[request_id]` 中。

接下来，引擎调用 `find_longest_cache_hit`，检查这些哈希是否已经存在于 `cached_block_hash_to_block` 中。对第一个请求，不会找到任何命中。

![图 6](https://vllm.ai/blog-assets/figures/2025-vllm-anatomy/prefix_pt1.png)

**图 6**：Prefix caching——哈希函数

然后我们调用 `allocate_slots`，它再调用 `coordinator.cache_blocks`，把新的 `BlockHash` 条目与我们分配的 KV block 关联起来，并记录到 `cached_block_hash_to_block` 中。

之后，前向传播会把 KV 填充到 paged KV cache 内存中，对应我们上面分配的那些 KV cache block。

> **注：** 经过许多 engine step 之后，它会分配更多 KV cache block，但这在我们的示例中无关紧要，因为前缀在 `long_prefix` 之后立刻就分叉了。

![图 7](https://vllm.ai/blog-assets/figures/2025-vllm-anatomy/prefix_pt2.png)

**图 7**：Prefix caching——把 KV 填充进 paged 内存

在第二次以相同前缀调用 `generate` 时，步骤 1-3 重复，但现在 `find_longest_cache_hit` 会为全部 `n` 个 block 找到匹配（通过线性搜索）。引擎可以直接复用这些 KV block。

![图 8](https://vllm.ai/blog-assets/figures/2025-vllm-anatomy/prefix_pt3.png)

**图 8**：Prefix caching——复用 KV

如果原请求还活着，这些 block 的引用计数会递增（例如变成 2）。在这个示例中，第一个请求已经完成，所以这些 block 已经被释放回池子，引用计数也被重置为 0。由于我们能从 `cached_block_hash_to_block` 中取回它们，我们知道它们是有效的（KV cache manager 的逻辑就是这样设计的），所以我们只需把它们再次从 `free_block_queue` 中移除。

> **进阶说明：** KV cache block 只有在即将从 `free_block_queue`（从左端弹出）被重新分配、而我们发现该 block 仍带有相关哈希且存在于 `cached_block_hash_to_block` 中时，才会失效。那一刻，我们会清除该 block 的哈希，并从 `cached_block_hash_to_block` 中移除它的条目，确保它不能再通过 prefix caching 被复用（至少对那个旧前缀而言）。

以上就是 prefix caching 的要旨：不要重复计算你已经见过的前缀——直接复用它们的 KV cache！

如果你理解了这个例子，你也就理解了 paged attention 是如何工作的。

Prefix caching 默认启用。要关闭它：`enable_prefix_caching = False`。

### Guided Decoding（FSM）

Guided decoding 是一种技术：在每个解码步骤，用基于文法的有限状态机约束 logits。这确保只有文法允许的 token 才能被采样。

这是一个很强大的设定：从正则文法（乔姆斯基 3 型，例如任意 regex 模式）一直到上下文无关文法（2 型，覆盖了大多数编程语言），你都可以施加约束。

为了不那么抽象，我们从最简单的例子开始，它建立在之前的代码之上：

```python
from vllm import LLM, SamplingParams
from vllm.sampling_params import GuidedDecodingParams

prompts = [
    "This sucks",
    "The weather is beautiful",
]

guided_decoding_params = GuidedDecodingParams(choice=["Positive", "Negative"])
sampling_params = SamplingParams(guided_decoding=guided_decoding_params)

def main():
    llm = LLM(model="TinyLlama/TinyLlama-1.1B-Chat-v1.0")

    outputs = llm.generate(prompts, sampling_params)

if __name__ == "__main__":
    main()
```

在我给出的这个玩具示例里（假设是字符级分词）：在 prefill 阶段，FSM 会掩掉 logits，使只有 "P" 或 "N" 可行。如果采样到 "P"，FSM 就走向 "Positive" 分支；下一步只允许 "o"，依此类推。

![图 9](https://vllm.ai/blog-assets/figures/2025-vllm-anatomy/fsm.png)

**图 9**：玩具示例的 FSM

这在 vLLM 中是如何工作的：

1. 在 LLM engine 构造时，会创建一个 `StructuredOutputManager`；它可以访问 tokenizer，并维护一个 `_grammar_bitmask` 张量。
2. 添加请求时，其状态被设为 `WAITING_FOR_FSM`，`grammar_init` 选择后端编译器（例如 `xgrammar`[\[7\]](#ref-7)；注意这些后端是第三方代码）。
3. 该请求的文法被异步编译。
4. 在调度期间，如果异步编译已经完成，状态就切换为 `WAITING`，`request_id` 被加入 `structured_output_request_ids`；否则它被放进 `skipped_waiting_requests`，在下一个 engine step 重试。
5. 在调度循环之后（仍然在调度内部），如果存在 FSM 请求，`StructuredOutputManager` 会请求后端准备 / 更新 `_grammar_bitmask`。
6. 前向传播产出 logits 之后，xgr_torch_compile 的函数把 bitmask 展开到词表大小（32 倍展开率，因为用的是 32 位整数），并把不允许的 logits 掩成 –∞。
7. 采样出下一个 token 之后，通过 `accept_tokens` 推进该请求的 FSM。从图上看，就是移动到 FSM 图中的下一个状态。

第 6 步值得进一步解释。

如果 `vocab_size = 32`，`_grammar_bitmask` 就是一个整数；它的二进制表示编码了哪些 token 被允许（"1"）、哪些被禁止（"0"）。例如，"101…001" 展开成长度 32 的数组 `[1, 0, 1, …, 0, 0, 1]`；值为 0 的位置，其 logits 被设为 –∞。词表更大时会使用多个 32 位字，并相应地展开 / 拼接。后端（例如 `xgrammar`）负责使用当前 FSM 状态产出这些位模式。

> **注：** 这里的大部分复杂度都藏在 xgrammar 这样的第三方库里。

下面是一个更简单的例子，`vocab_size = 8`，使用 8 位整数（给喜欢我这些图示的读者）：

![图 10](https://vllm.ai/blog-assets/figures/2025-vllm-anatomy/fsm2.png)

**图 10**：玩具示例

在 vLLM 中，传入所需的 `guided_decoding` 配置即可启用这一切。

### Speculative Decoding

在自回归生成中，每个新 token 都需要大模型做一次前向传播。这很昂贵——每一步都要重新加载并应用全部模型权重，只为了计算一个 token！（假设 batch size == 1，一般情况下是 `B`）

Speculative decoding[\[8\]](#ref-8) 通过引入一个更小的草稿模型（draft LM）来加速。草稿模型廉价地提出 `k` 个 token。但我们最终并不想从小模型采样——它只是用来猜测候选续写。决定什么有效的仍然是大模型。

步骤如下：

1. **起草（Draft）**：在当前上下文上运行小模型，提出 `k` 个 token
2. **验证（Verify）**：在「上下文 + `k` 个草稿 token」上运行一次大模型。这会产出这 `k` 个位置外加一个额外位置的概率（于是得到 `k+1` 个候选）
3. **接受 / 拒绝**：从左到右遍历 `k` 个草稿 token：
   * 如果大模型给该草稿 token 的概率 ≥ 草稿模型给它的概率，就接受它
   * 否则以 `p_large(token)/p_draft(token)` 的概率接受它
   * 遇到第一次拒绝就停止，或者接受全部 `k` 个草稿 token
   * 如果 `k` 个草稿 token 全部被接受，还可以「免费」从大模型采样出第 `(k+1)` 个 token（那个分布我们已经算出来了）
   * 如果发生了拒绝，就在该位置构造一个重新平衡的分布（`p_large - p_draft`，最小值截断到 0，归一化到和为 1），并从中采样最后一个 token

**为什么这样有效**：虽然我们用小模型来提候选，但接受 / 拒绝规则保证了在期望意义上，序列的分布与「逐 token 从大模型采样」完全一致。也就是说，speculative decoding 在统计上等价于标准自回归解码——但可能快得多，因为一次大模型前向最多可以产出 `k+1` 个 token。

> **注：** 推荐看 [gpt-fast](https://github.com/meta-pytorch/gpt-fast) 里的简单实现，以及[原始论文](https://arxiv.org/abs/2302.01318)中的数学细节和「与从完整模型采样等价」的证明。

vLLM V1 不支持「LLM 草稿模型」这种方法，而是实现了更快但精度更低的提议方案：n-gram、EAGLE[\[9\]](#ref-9) 和 Medusa[\[10\]](#ref-10)。

每种一句话概括：

* **n-gram**：取最后 `prompt_lookup_max` 个 token；在序列中查找此前是否出现过匹配；如果找到，就提议该匹配之后跟着的 `k` 个 token；否则缩小窗口重试，直到 `prompt_lookup_min`
* **Eagle**：对大型 LM 做「模型手术」——保留 embedding 和 LM head，把 transformer 主体换成一个轻量 MLP；再把它微调成一个廉价的草稿模型
* **Medusa**：在大模型之上（LM head 之前的 embedding 上）训练若干辅助线性头，并行预测接下来 `k` 个 token；用这些头来提议 token，比单独跑一个小 LM 更高效

> **注：** 当前实现返回**第一个**匹配之后的 `k` 个 token。引入近因偏好、把搜索方向反过来（即用最后一个匹配）似乎更自然？

下面是在 vLLM 中用 `ngram` 作为草稿方法调用 speculative decoding 的方式：

```python
from vllm import LLM, SamplingParams

prompts = [
    "Hello, my name is",
    "The president of the United States is",
]

sampling_params = SamplingParams(temperature=0.8, top_p=0.95)

speculative_config={
    "method": "ngram",
    "prompt_lookup_max": 5,
    "prompt_lookup_min": 3,
    "num_speculative_tokens": 3,
}

def main():
    llm = LLM(model="TinyLlama/TinyLlama-1.1B-Chat-v1.0", speculative_config=speculative_config)

    outputs = llm.generate(prompts, sampling_params)

if __name__ == "__main__":
    main()
```

这在 vLLM 中是如何工作的？

**初始化（在引擎构造期间）：**

1. 初始化设备：创建一个 `drafter`（草稿模型，例如 `NgramProposer`）和一个 `rejection_sampler`（其中一部分用 Triton 写成）。
2. 加载模型：加载草稿模型权重（对 n-gram 而言是空操作）。

**之后在 `generate` 函数中**（假设来了一个全新的请求）：

1. 用大模型运行常规的 prefill 步骤。
2. 在前向传播和标准采样之后，调用 `propose_draft_token_ids(k)`，从草稿模型采样出 `k` 个草稿 token。
3. 把它们存入 `request.spec_token_ids`（更新请求元数据）。
4. 在下一个 engine step，当该请求处于 running 队列时，把 `len(request.spec_token_ids)` 加到「新 token」计数上，这样 `allocate_slots` 会为前向传播预留足够的 KV block。
5. 把 `spec_token_ids` 拷进 `input_batch.token_ids_cpu`，组成「上下文 + 草稿」token。
6. 通过 `_calc_spec_decode_metadata` 计算元数据（它会从 `input_batch.token_ids_cpu` 拷贝 token、准备 logits 等），然后在草稿 token 上运行一次大模型前向传播。
7. 不再从 logits 做常规采样，而是用 `rejection_sampler` 从左到右接受 / 拒绝，产出 `output_token_ids`。
8. 重复第 2-7 步，直到满足停止条件。

内化这套流程最好的方式是打开调试器、在代码库里单步走一遍，但本节应该能让你对它有个大致感觉。下面两张图也是：

![图 11a](https://vllm.ai/blog-assets/figures/2025-vllm-anatomy/specdec_pt1.png)

![图 11b](https://vllm.ai/blog-assets/figures/2025-vllm-anatomy/specdec_pt2.png)

**图 11**：Speculative decoding

### Disaggregated P/D

我之前已经暗示过 disaggregated P/D（prefill/decode 分离）的动机。

Prefill 和 decode 的性能画像非常不同（计算受限 vs. 显存带宽受限），所以把它们的执行分开是合理的设计。它能让我们更精细地控制延迟——包括 `TTFT`（首 token 时间）和 `ITL`（token 间延迟）——更多内容见基准测试一节。

在实践中，我们运行 `N` 个 vLLM prefill 实例和 `M` 个 vLLM decode 实例，并根据实时请求构成对它们做自动扩缩容。prefill worker 把 KV 写入一个专用的 KV cache 服务；decode worker 从中读取。这就把「长而突发」的 prefill 与「平稳且对延迟敏感」的 decode 隔离开了。

这在 vLLM 中是如何工作的？

为清晰起见，下面的示例依赖 `SharedStorageConnector`，这是一个用于说明机制的调试用 connector 实现。

Connector 是 vLLM 处理实例之间 KV 交换的抽象。connector 接口尚不稳定，近期已有一些改进计划，其中部分可能带来破坏性变更。

我们启动 2 个 vLLM 实例（GPU 0 做 prefill，GPU 1 做 decode），然后在它们之间传输 KV cache：

```python
import os
import time
from multiprocessing import Event, Process
import multiprocessing as mp

from vllm import LLM, SamplingParams
from vllm.config import KVTransferConfig

prompts = [
    "Hello, my name is",
    "The president of the United States is",
]

def run_prefill(prefill_done):
  os.environ["CUDA_VISIBLE_DEVICES"] = "0"

  sampling_params = SamplingParams(temperature=0, top_p=0.95, max_tokens=1)

  ktc=KVTransferConfig(
      kv_connector="SharedStorageConnector",
      kv_role="kv_both",
      kv_connector_extra_config={"shared_storage_path": "local_storage"},
  )

  llm = LLM(model="TinyLlama/TinyLlama-1.1B-Chat-v1.0", kv_transfer_config=ktc)
  llm.generate(prompts, sampling_params)

  prefill_done.set()  # 通知 decode 实例：KV cache 已就绪

  # 让 prefill 节点保持运行，以防 decode 节点还没结束；
  # 否则脚本可能提前退出，导致解码不完整。
  try:
      while True:
          time.sleep(1)
  except KeyboardInterrupt:
      print("Script stopped by user.")

def run_decode(prefill_done):
  os.environ["CUDA_VISIBLE_DEVICES"] = "1"

  sampling_params = SamplingParams(temperature=0, top_p=0.95)

  ktc=KVTransferConfig(
      kv_connector="SharedStorageConnector",
      kv_role="kv_both",
      kv_connector_extra_config={"shared_storage_path": "local_storage"},
  )

  llm = LLM(model="TinyLlama/TinyLlama-1.1B-Chat-v1.0", kv_transfer_config=ktc)

  prefill_done.wait()  # 阻塞等待来自 prefill 实例的 KV cache

  # 内部会先取 KV cache，再开始解码循环
  outputs = llm.generate(prompts, sampling_params)

if __name__ == "__main__":
  prefill_done = Event()
  prefill_process = Process(target=run_prefill, args=(prefill_done,))
  decode_process = Process(target=run_decode, args=(prefill_done,))

  prefill_process.start()
  decode_process.start()

  decode_process.join()
  prefill_process.terminate()
```

> **注：** 我也试过 `LMCache`[\[11\]](#ref-11)——最快的生产级 connector（底层用 NVIDIA 的 NIXL），但它仍处于最前沿，我遇到了一些 bug。由于它的大部分复杂度都在外部仓库里，用 `SharedStorageConnector` 来做讲解更合适。

vLLM 内部的步骤如下：

1. **实例化**——在引擎构造期间，connector 在两处被创建：
   * 一处在 worker 的初始化设备过程中（在 init worker distributed environment 函数下），角色为 "worker"。
   * 一处在 scheduler 构造函数里，角色为 "scheduler"。
2. **缓存查询**——当调度器处理 `waiting` 队列里的 prefill 请求时（在本地 prefix cache 检查之后），会调用 connector 的 `get_num_new_matched_tokens`。这会检查 KV cache 服务器里是否有外部缓存的 token。prefill 在这里总是看到 0；decode 则可能命中缓存。该结果会加到本地计数上，然后再调用 `allocate_slots`。
3. **状态更新**——调度器接着调用 `connector.update_state_after_alloc`，记录哪些请求命中了缓存（对 prefill 是空操作）。
4. **构建 meta**——在调度结束时，调度器调用 `meta = connector.build_connector_meta`：
   * prefill 把所有请求以 `is_store=True` 加入（用于上传 KV）。
   * decode 把请求以 `is_store=False` 加入（用于拉取 KV）。
5. **上下文管理器**——在前向传播之前，引擎进入一个 KV connector 上下文管理器：
   * 进入时：调用 `kv_connector.start_load_kv`。对 decode，它从外部服务器加载 KV 并注入 paged 内存；对 prefill 是空操作。
   * 退出时：调用 `kv_connector.wait_for_save`。对 prefill，它阻塞直到 KV 上传到外部服务器；对 decode 是空操作。

下面是一个可视化的例子：

![图 12](https://vllm.ai/blog-assets/figures/2025-vllm-anatomy/pd.png)

**图 12**：Disaggregated P/D

> **补充说明：**
>
> * 对 `SharedStorageConnector` 而言，「外部服务器」其实就是本地文件系统。
> * 根据配置不同，KV 传输也可以逐层进行（在每个注意力层之前 / 之后）。
> * decode 只在其请求的第一步加载一次外部 KV；之后就本地计算、本地存储。

## 从 UniProcExecutor 到 MultiProcExecutor

核心技术就位之后，我们就可以谈向上扩展了。

假设你的模型权重已经放不进单张 GPU 的显存。

第一个选择是使用张量并行（tensor parallelism，例如 `TP=8`）把模型切分到同一节点的多张 GPU 上。如果模型仍然放不下，下一步就是跨节点的流水线并行（pipeline parallelism）。

> **注：**
>
> * 节点内带宽显著高于节点间带宽，这也是张量并行（TP）通常优先于流水线并行（PP）的原因。（PP 通信的数据量确实比 TP 少，这一点也成立。）
> * 我不覆盖专家并行（EP），因为我们聚焦标准 transformer 而非 MoE；也不覆盖序列并行——因为实践中最常用的是 TP 和 PP。

到这一步，我们需要多个 GPU 进程（worker）以及一个协调它们的编排层。这正是 `MultiProcExecutor` 提供的东西。

![图 13](https://vllm.ai/blog-assets/figures/2025-vllm-anatomy/multiprocexecutor.png)

**图 13**：TP=8 设定下的 MultiProcExecutor（driver worker 是 rank 0）

这在 vLLM 中是如何工作的：

1. `MultiProcExecutor` 初始化一个 `rpc_broadcast_mq` 消息队列（底层用共享内存实现）。
2. 构造函数遍历 `world_size`（例如 `TP=8 ⇒ world_size=8`），通过 `WorkerProc.make_worker_process` 为每个 rank 派生一个守护进程。
3. 对每个 worker，父进程先创建一个读管道和一个写管道。
4. 新进程运行 `WorkerProc.worker_main`，它实例化一个 worker（经历与 `UniProcExecutor` 中相同的「初始化设备」「加载模型」等过程）。
5. 每个 worker 判断自己是 driver（TP 组里的 rank 0）还是普通 worker。每个 worker 都建立两个队列：
   * `rpc_broadcast_mq`（与父进程共享），用于接收工作。
   * `worker_response_mq`，用于回送响应。
6. 初始化期间，每个子进程通过管道把自己的 `worker_response_mq` 句柄发给父进程。全部收到之后，父进程解除阻塞——协调到此完成。
7. 随后 worker 进入忙循环，阻塞在 `rpc_broadcast_mq.dequeue` 上。有工作项到达时就执行它（与 `UniProcExecutor` 中一样，只是现在带着 TP/PP 特定的切分工作）。结果通过 `worker_response_mq.enqueue` 送回。
8. 运行时，请求到达后 `MultiProcExecutor` 把它（非阻塞地）入队到 `rpc_broadcast_mq`，广播给所有子 worker；然后等待指定输出 rank 的 `worker_response_mq.dequeue` 来收集最终结果。

从引擎的视角看，什么都没有变——所有这些多进程的复杂度都被抽象在一次对 model executor `execute_model` 的调用之后。

* 在 `UniProcExecutor` 的情形下：`execute_model` 直接导致在 worker 上调用 `execute_model`。
* 在 `MultiProcExecutor` 的情形下：`execute_model` 通过 `rpc_broadcast_mq` 间接导致在每个 worker 上调用 `execute_model`。

到此为止，用同一套引擎接口，我们就能跑资源允许的任意大的模型。

下一步是向外扩展：启用数据并行（`DP > 1`），把模型复制到多个节点上，加一层轻量的 DP 协调层，在副本之间引入负载均衡，并在前面放一个或多个 API server 来处理进入的流量。

## 服务 vLLM 的分布式系统

搭建服务基础设施的方式有很多，但为了具体，这里给一个例子：假设我们有两个 H100 节点，想在它们之上运行四个 vLLM 引擎。

如果模型需要 `TP=4`，我们可以这样配置节点。

![图 14](https://vllm.ai/blog-assets/figures/2025-vllm-anatomy/server_setup.png)

**图 14**：两个 8×H100 节点的服务器配置（1 个 headless 节点，1 个 API server 节点）

在第一个节点上，以 headless 模式（不带 API server）运行引擎，参数如下：

```python
vllm serve <model-name>
  --tensor-parallel-size 4
  --data-parallel-size 4
  --data-parallel-size-local 2
  --data-parallel-start-rank 0
  --data-parallel-address <master-ip>
  --data-parallel-rpc-port 13345
  --headless
```

然后在另一个节点上运行同一条命令，只做少量调整：

* 去掉 `--headless`
* 修改 DP 起始 rank

```python
vllm serve <model-name>
  --tensor-parallel-size 4
  --data-parallel-size 4
  --data-parallel-size-local 2
  --data-parallel-start-rank 2
  --data-parallel-address <master-ip>
  --data-parallel-rpc-port 13345
```

> **注：** 这里假设网络已经配置好，使所有节点都能访问指定的 IP 和端口。

这在 vLLM 中是如何工作的？

### 在 headless 服务节点上

在 headless 节点上，一个 `CoreEngineProcManager` 会启动 2 个进程（数量由 `--data-parallel-size-local` 决定），每个进程运行 `EngineCoreProc.run_engine_core`。这些函数各自创建一个 `DPEngineCoreProc`（engine core），然后进入它的忙循环。

`DPEngineCoreProc` 初始化它的父类 `EngineCoreProc`（`EngineCore` 的子类），后者会：

1. 创建一个 `input_queue` 和一个 `output_queue`（`queue.Queue`）。
2. 使用 `DEALER` ZMQ socket（异步消息库）与另一节点上的前端进行初始握手，并接收协调地址信息。
3. 初始化 DP 组（例如使用 NCCL 后端）。
4. 用 `MultiProcExecutor` 初始化 `EngineCore`（如前所述，`TP=4`、4 张 GPU）。
5. 创建一个 `ready_event`（`threading.Event`）。
6. 启动一个输入守护线程（`threading.Thread`）运行 `process_input_sockets(…, ready_event)`。同样再启动一个输出线程。
7. 仍在主线程中，等待 `ready_event`，直到横跨两个节点的全部 4 个进程的输入线程都完成协调握手，并最终执行 `ready_event.set()`。
8. 解除阻塞后，向前端发送一条「ready」消息，附带元数据（例如 paged KV cache 内存中可用的 `num_gpu_blocks`）。
9. 随后，主线程、输入线程和输出线程各自进入自己的忙循环。

简而言之，最终得到的是 4 个子进程（每个 DP 副本一个），每个进程运行一个主线程、一个输入线程、一个输出线程。它们与 DP coordinator 和前端完成协调握手，然后每个进程的这三个线程就一直在稳态忙循环中运转。

![图 15](https://vllm.ai/blog-assets/figures/2025-vllm-anatomy/dpenginecoreproc.png)

**图 15**：由 4 个 DP 副本组成的分布式系统，运行着 4 个 `DPEngineCoreProc`（每个都带主线程、输入线程、输出线程）

**当前稳态：**

* **输入线程**：阻塞在输入 socket 上，直到 API server 路由来一个请求；收到后解码 payload，通过 `input_queue.put_nowait(...)` 入队一个工作项，然后回到对 socket 的阻塞。
* **主线程**：在 `input_queue.get(...)` 上被唤醒，把请求喂给引擎；`MultiProcExecutor` 运行前向传播，并把结果入队到 `output_queue`。
* **输出线程**：在 `output_queue.get(...)` 上被唤醒，把结果回送给 API server，然后恢复阻塞。

**另外的机制：**

* **DP wave 计数器**：系统跟踪「wave（波次）」；当所有引擎都空闲时它们进入静止状态，有新工作到达时计数器递增（用于协调和指标统计）。
* **控制消息**：API server 能发送的不只是推理请求（例如 abort 以及各类 utility / 控制 RPC）。
* **为 lockstep 而做的 dummy step**：只要任一 DP 副本有工作，所有副本都会执行一次前向 step；没有请求的副本执行一个 dummy step，以参与必要的同步点（避免阻塞那个活跃副本）。

> **关于 lockstep 的澄清：** lockstep 实际上只对 MoE 模型才是必需的——那时专家层构成一个 EP 或 TP 组，而注意力层仍是 DP。目前它对所有 DP 都总是执行，这主要是因为「内置的非 MoE DP」用途有限：你完全可以跑多个独立的 vLLM，再用常规方式在它们之间做负载均衡。

### 在 API server 节点上

我们实例化一个 `AsyncLLM` 对象（围绕 LLM 引擎的 asyncio 封装）。它内部会创建一个 `DPLBAsyncMPClient`：数据并行、负载均衡、异步、多进程的客户端。

在 `MPClient` 父类内部，`launch_core_engines` 函数会运行，并：创建用于启动握手的 ZMQ 地址（和在 headless 节点上看到的一样）；派生一个 `DPCoordinator` 进程；创建一个 `CoreEngineProcManager`（也与 headless 节点上的相同）。

在 `AsyncMPClient`（`MPClient` 的子类）内部，我们会：创建一个 `outputs_queue`（`asyncio.Queue`）；创建一个 asyncio 任务 `process_outputs_socket`，它通过输出 socket 与全部 4 个 `DPEngineCoreProc` 的输出线程通信，并写入 `outputs_queue`；随后再创建一个 asyncio 任务 `output_handler`（来自 `AsyncLLM`），它从这个队列读取，并最终把信息发送给 `create_completion` 函数。在 `DPAsyncMPClient` 内部，我们还创建一个 asyncio 任务 `run_engine_stats_update_task`，它与 DP coordinator 通信。

DP coordinator 在前端（API server）与后端（engine core）之间居中协调。它会：周期性地把负载均衡信息（队列大小、waiting/running 请求数）发送给前端的 `run_engine_stats_update_task`；处理来自前端的 `SCALE_ELASTIC_EP` 命令，动态改变引擎数量（仅在使用 Ray 后端时有效）；在被前端触发时向后端发送 `START_DP_WAVE` 事件，并把 wave 状态更新回报回去。

回顾一下，前端（`AsyncLLM`）运行若干 asyncio 任务（记住：是并发，不是并行）：一类任务通过 generate 路径处理输入请求（每个新客户端请求都会派生一个新的 asyncio 任务）；两个任务（`process_outputs_socket`、`output_handler`）处理来自底层引擎的输出消息；一个任务（`run_engine_stats_update_task`）维护与 DP coordinator 的通信：发送 wave 触发、轮询负载均衡状态、处理动态扩缩容请求。

最后，主服务进程创建一个 FastAPI 应用，并挂载诸如 `OpenAIServingCompletion` 和 `OpenAIServingChat` 之类的端点，它们暴露 `/completion`、`/chat/completion` 等接口。整个栈通过 Uvicorn 对外服务。

### 请求的完整生命周期

把以上全部串起来：当你在终端里发出：

```bash
curl -X POST http://localhost:8000/v1/completions -H "Content-Type: application/json" -d '{
  "model": "TinyLlama/TinyLlama-1.1B-Chat-v1.0",
  "prompt": "The capital of France is",
  "max_tokens": 50,
  "temperature": 0.7
}'
```

接下来发生的事是：

1. 请求打到 API server 上 `OpenAIServingCompletion` 的 `create_completion` 路由。
2. 该函数异步地对 prompt 分词，并准备元数据（request ID、采样参数、时间戳等）。
3. 然后调用 `AsyncLLM.generate`，它走与同步引擎相同的流程，最终调用 `DPAsyncMPClient.add_request_async`。
4. 后者又调用 `get_core_engine_for_request`，根据 DP coordinator 的状态在各引擎之间做负载均衡，选出分数最小（负载最低）的那个：`score = len(waiting) * 4 + len(running)`。
5. ADD 请求被发送到所选引擎的 `input_socket`。

在那个引擎上：

* **输入线程**：解除阻塞，从输入 socket 解码数据，把一个工作项放上 `input_queue` 交给主线程。
* **主线程**：在 `input_queue` 上解除阻塞，把请求加入引擎，并反复调用 `engine_core.step()`，把中间结果入队到 `output_queue`，直到满足停止条件。提醒一下：`step()` 会调用调度器、model executor（它自己可能就是一个 `MultiProcExecutor`！）等——这些前面都已经见过了。
* **输出线程**：在 `output_queue` 上解除阻塞，通过输出 socket 把结果送回。
* 这些结果触发 `AsyncLLM` 的输出 asyncio 任务（`process_outputs_socket` 和 `output_handler`），把 token 传回 FastAPI 的 `create_completion` 路由。
* FastAPI 附加元数据（finish reason、logprobs、usage 信息等），并通过 Uvicorn 把一个 `JSONResponse` 返回到你的终端。

就这样，你的补全结果回来了——整套分布式机器都藏在一条简单的 curl 命令背后。

> **补充说明：** 增加更多 API server 时，负载均衡在操作系统 / socket 层处理；从应用视角看没有实质性变化，因为复杂度被隐藏了。以 Ray 作为 DP 后端时，你可以暴露一个 URL 端点（`/scale_elastic_ep`），用于自动增减引擎副本数量。

## 基准测试与自动调优——延迟 vs 吞吐

到目前为止，我们看的都是「显微镜下」的细节——请求如何在引擎和系统内部流动。现在该拉远镜头，把系统当作整体来看，并问：如何度量一个推理系统的性能？

在最高层面上，有两个相互竞争的指标。**延迟（Latency）**是从请求提交到 token 返回所经过的时间。**吞吐（Throughput）**是系统每秒能生成 / 处理的 token 数或请求数。延迟对交互式应用最重要，因为用户在等响应。吞吐对离线负载最重要，例如为预训练 / 后训练生成合成数据、数据清洗与处理，以及一般而言任何离线批量推理任务。

在解释延迟与吞吐为何相互竞争之前，先定义几个常见的推理指标：

| 指标 | 定义 |
| --- | --- |
| **TTFT**（首 token 时间） | 从请求提交到收到第一个输出 token 的时间。 |
| **ITL**（token 间延迟） | 两个相邻 token 之间的时间（例如从 token i-1 到 token i）。 |
| **TPOT**（每输出 token 时间） | 一个请求中所有输出 token 的平均 ITL。 |
| **Latency / E2E**（端到端延迟） | 处理一个请求的总时间，即 TTFT 加上所有 ITL 之和，等价于从提交请求到收到最后一个输出 token 的时间。 |
| **Throughput**（吞吐） | 每秒处理的 token 总数（输入、输出或两者），或者每秒请求数。 |
| **Goodput**（有效吞吐） | 满足服务级目标（SLO，如最大 TTFT、TPOT 或 E2E 延迟）的吞吐。例如只统计满足这些 SLO 的请求所产生的 token。 |

![图 16](https://vllm.ai/blog-assets/figures/2025-vllm-anatomy/latency_diagram.png)

**图 16**：TTFT、ITL 与端到端延迟

下面是一个解释这两个指标为何相互竞争的简化模型。假设是：权重 I/O（而非 KV cache I/O）占主导，也就是我们在处理短序列。看 batch size `B` 如何影响单个 decode step，这个权衡就很清楚了。当 `B` 降向 1 时，ITL 下降：每个 step 的工作更少，token 也不与其他 token「竞争」。当 `B` 升向无穷大时，ITL 上升，因为每个 step 做的 FLOPs 更多——但吞吐会改善（直到触及峰值性能），因为权重 I/O 被摊薄到更多 token 上。

Roofline 模型在这里很有帮助。在饱和 batch `B_sat` 以下，step 时间由 HBM 带宽主导（把权重逐层流式送进片上内存），所以 step 延迟几乎持平——算 1 个 token 与算 10 个 token 可能花差不多的时间。超过 `B_sat` 之后，kernel 变成算力受限，step 时间大致随 `B` 增长；每多一个 token 都会加到 ITL 上。

![图 17](https://vllm.ai/blog-assets/figures/2025-vllm-anatomy/roofline.png)

**图 17**：Roofline 性能模型

> **注：** 更严格的处理必须考虑 kernel 自动调优：随着 `B` 增长，运行时可能切换到对该 shape 更高效的 kernel，从而改变实际达成的性能 `P_kernel`。step 延迟为 `t = FLOPs_step / P_kernel`，其中 `FLOPs_step` 是该 step 的工作量。可以看到，当 `P_kernel` 逼近 `P_peak` 时，每个 step 更多的计算会直接导致延迟上升。

### 如何在 vLLM 中做基准测试

vLLM 提供 `vllm bench {serve,latency,throughput}` CLI，它封装了 `vllm/benchmarks/{server,latency,throughput}.py`。各脚本的作用：

* **latency**：使用较短输入（默认 32 token），以小 batch（默认 8）采样 128 个输出 token。它跑若干次迭代，并报告该 batch 的端到端延迟。
* **throughput**：一次性提交一组固定的 prompt（默认 1000 条 ShareGPT 样本），也称 QPS=Inf 模式，并报告整个运行过程中的输入 / 输出 / 总 token 数与每秒请求数。
* **serve**：启动一个 vLLM server，并通过从泊松（或更一般地，伽马）分布采样请求到达间隔来模拟真实负载。它在一个时间窗内发送请求，度量上面讨论过的所有指标，并可选地通过信号量强制服务端最大并发（例如把 server 限制到 64 个并发请求）。

下面是运行 latency 脚本的一个例子：

```bash
vllm bench latency
  --model <model-name>
  --input-tokens 32
  --output-tokens 128
  --batch-size 8
```

CI 中使用的基准测试配置位于 `.buildkite/nightly-benchmarks/tests` 下。还有一个 auto-tune 脚本，它驱动 serve 基准测试来寻找满足目标 SLO 的参数设置（例如「在保持 p99 E2E < 500 ms 的同时最大化吞吐」），并返回一个推荐配置。

## 结语

我们从基本的 engine core（`UniProcExecutor`）出发，加上了 speculative decoding、prefix caching 等高级特性，向上扩展到 `MultiProcExecutor`（TP/PP > 1），最后向外扩展，把一切包进异步引擎与分布式服务栈，并以「如何度量系统性能」收尾。

vLLM 还包含本文跳过的专门处理，例如：

* **多样的硬件后端**：TPU、AWS Neuron（Trainium/Inferentia）等。
* **架构 / 技术**：MLA、MoE、encoder-decoder（例如 Whisper）、pooling / embedding 模型、EPLB、m-RoPE、LoRA、ALiBi、无注意力变体、滑动窗口注意力、多模态 LM，以及状态空间模型（例如 Mamba/Mamba-2、Jamba）。
* **TP/PP/SP** 的各种并行变体。
* **混合 KV cache 逻辑**（Jenga）、更复杂的采样方法如 beam sampling，等等。
* **实验性**：async scheduling（异步调度）。

好在这些大多与上面描述的主流程正交——你几乎可以把它们当作「插件」来对待（实践中当然存在一些耦合）。在这个高度上，分辨率确实有所牺牲；后续文章会放大到具体子系统、深入细节。

## 致谢

原文由 Aleksa Gordic 撰写。实验所用的 H100 由 Hyperstack 提供。预发布版本由 Nick Hill（vLLM 核心贡献者，Red Hat）、Mark Saroufim（PyTorch）、Kyle Krannen（NVIDIA，Dynamo）与 Ashish Vaswani 审阅并给出反馈。

## 参考文献

1. <a id="ref-1"></a>[vLLM](https://github.com/vllm-project/vllm)
2. <a id="ref-2"></a>[Attention Is All You Need](https://arxiv.org/abs/1706.03762)
3. <a id="ref-3"></a>[Efficient Memory Management for Large Language Model Serving with PagedAttention](https://arxiv.org/abs/2309.06180)
4. <a id="ref-4"></a>[DeepSeek-V2: A Strong, Economical, and Efficient Mixture-of-Experts Language Model](https://arxiv.org/abs/2405.04434)
5. <a id="ref-5"></a>[Jenga: Effective Memory Management for Serving LLM with Heterogeneity](https://arxiv.org/abs/2503.18292)
6. <a id="ref-6"></a>[Orca: A Distributed Serving System for Transformer-Based Generative Models](https://www.usenix.org/conference/osdi22/presentation/yu)
7. <a id="ref-7"></a>[XGrammar: Flexible and Efficient Structured Generation Engine for Large Language Models](https://arxiv.org/abs/2411.15100)
8. <a id="ref-8"></a>[Accelerating Large Language Model Decoding with Speculative Sampling](https://arxiv.org/abs/2302.01318)
9. <a id="ref-9"></a>[EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty](https://arxiv.org/abs/2401.15077)
10. <a id="ref-10"></a>[Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads](https://arxiv.org/abs/2401.10774)
11. <a id="ref-11"></a>[LMCache](https://github.com/LMCache/LMCache)

---

*译自 <https://vllm.ai/blog/2025-09-05-anatomy-of-vllm>（原文首发于 <https://www.aleksagordic.com/blog/vllm>）。文中代码、类名与参数名保留英文原文；图片链接指向原文站点。*
