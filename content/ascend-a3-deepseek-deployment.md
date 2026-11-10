## 实验目标与并行配置

TTFT（Time to First Token）是从客户端发起请求到收到首个生成 token 的时间。本次性能测试只生成 1 个 token，重点观察首 token 延迟；精度测试另用 GSM8K 和 GPQA Diamond 的完整评测范围。

| 配置 | 数据并行 DP | 张量并行 TP | 流水并行 PP | 逻辑 NPU 数 |
|---|---:|---:|---:|---:|
| DP4TP4 | 4 | 4 | 1 | 16 |
| PP4TP4 | 1 | 4 | 4 | 16 |

DP4TP4 使用四个数据并行组，每组进行四路张量并行；PP4TP4 将模型分为四个流水阶段，每阶段进行四路张量并行。两组都启用专家并行 EP。

## 硬件与实验环境

本次使用单机昇腾 A3，配备 8 块板、16 个逻辑 NPU。npu-smi 显示每个逻辑设备 HBM 为 65,536 MB，总计约 1 TiB；这里的 64 GiB 指单个逻辑设备，避免与物理板卡数量混淆。

![npu-smi 显示 16 个逻辑 NPU 的设备状态与 HBM 容量](/images/ascend-a3-deployment/image.png)

## 权重与依赖准备

### 模型权重与评测数据集

准备 [DeepSeek-V4.1-Flash W4A8 模型权重](https://ai.gitcode.com/Eco-Tech/DeepSeek-V4.1-Flash-w4a8)，本次使用 DeepSeek-V4.1-Flash-1017-W4A8，共 81 个权重分片，目录占用约 493G。

![模型目录占用约 493G](/images/ascend-a3-deployment/image-1.png)

![模型权重目录中的分片与配置文件](/images/ascend-a3-deployment/image-2.png)

模型权重准备的同时，还需要下载精度测试使用的数据集。本次选择 GSM8K 的完整测试集和 GPQA Diamond 子集，分别用于检查数学推理和较高难度的科学问答能力。

| 数据集 | 本次评测范围 | 使用文件 |
|---|---:|---|
| GSM8K test | 1,319 题 | `gsm8k/test.jsonl` |
| GPQA Diamond | 198 题 | `gpqa/gpqa_diamond.csv` |

首先，从 AISBench 数据集说明中提供的 OpenCompass 下载源获取两个压缩包，保存在服务器的实验目录中。GPQA 压缩包包含多个子集，本次只读取 Diamond；GSM8K 使用 test，不将训练集计入测试题数。评测环境中，通过 AISBench 关联已下载的数据集，进行数据读取、提示模板和评分逻辑，由实验脚本通过 HTTP 调用模型服务。这两份数据用于精度测试；16K、128K 的 TTFT 性能测试由压测脚本生成固定长度的 token 输入，以控制输入长度和缓存命中率。

### HDK 与 CANN 的分工

在进行实验之前，我们需要确认环境中的 CANN 和 HDK 已配置好。这里我们复用宿主机已有 Docker，拉取昇腾 CANN 基础镜像，并在容器内配置推理框架。

宿主机已有 HDK 26.1.1，本次沿用驱动和固件，不进行升级。HDK 负责底层设备访问和管理；容器内的 CANN 9.2.1 提供计算运行时、算子与编译支持。先确认宿主机能识别 NPU，再配置容器内的框架依赖。

本次环境记录如下，版本号对应实验快照：

| 项目 | 本次实际配置 |
|---|---|
| 操作系统 | Ubuntu 22.04.4 LTS，aarch64，内核 5.15.0-94-generic |
| NPU | 昇腾 A3，8 块板、16 个逻辑 NPU；每个逻辑设备 HBM 65,536 MB，总计约 1 TiB |
| 主机内存 | 约 2 TiB |
| Docker | 29.1.3 |
| HDK 驱动 | 26.1.1，宿主机已有版本，本次未重装或升级 |
| CANN | 9.2.1，位于容器内 |
| 推理 Python | 3.12.16，使用容器基础 Python，不另建推理虚拟环境 |
| PyTorch / torch-npu | 2.10.0+cpu / 2.10.0.post7；NPU 支持由 torch-npu 提供 |
| Triton / triton-ascend | 3.6.0 / 3.6.0.post2 |
| Transformers / NumPy | 5.19.0 / 1.26.4 |
| vLLM | 0.32.0+empty，提交 `5df63a7203cdb9328d824a27b682e77c7b9928be` |
| vllm-ascend | 0.1.dev1+gd0159b927，PR #19284 HEAD：`d0159b92738cbbdf8680b266c8fc604fb9cf1ef2` |
| Mooncake | transfer-engine 0.3.13 |
| MemFabric | Hybrid 1.3.0，AccOffload 扩展已安装 |
| FLA A3 | flash-linear-attention-npu-a3 26.9.1 |
| W4A8 推理容器 | `dsv41-w4a8` |

### 固定源码并构建推理环境

本次实验采用 vLLM 与 vllm-ascend 作为推理框架，其中 vLLM 负责请求调度和推理服务，vllm-ascend 提供昇腾平台适配。环境准备分为容器配置、源码版本固定、依赖安装与编译、运行验证四个步骤。

#### （1）准备推理容器

首先，在宿主机已有的 Docker 环境中拉取昇腾 CANN 9.2.1 基础镜像，创建实验容器。将 16 个逻辑 NPU 映射到容器中，同时挂载宿主驱动、模型权重和工作目录，使容器能够访问计算设备和实验文件。

推理框架最初安装在 `dsv41-pr19284` 容器中。完成安装和验证后，将环境保存为本地镜像 `dsv41-w4a8-env:20261109-rawid`，再创建 `dsv41-w4a8` 容器进行 W4A8 实验。这样可以复用已编译的环境，并为后续测试保持一致的软件依赖。

#### （2）固定 vLLM 与 PR 代码版本

为了让实验结果能够复现，需要同时固定 vLLM 和 vllm-ascend 的代码版本。本次将 vllm-ascend 固定到 PR #19284 在实验时使用的 HEAD 提交，将 vLLM 固定到对应的实验基线：

| 仓库 | 固定提交 |
|---|---|
| vLLM | `5df63a7203cdb9328d824a27b682e77c7b9928be` |
| vllm-ascend（PR #19284） | `d0159b92738cbbdf8680b266c8fc604fb9cf1ef2` |

具体做法是按完整 commit SHA 获取源码，并切换到 detached HEAD 状态。这样即使后续主分支或 PR 继续更新，本次实验仍使用同一份代码。以下为初次准备源码时的命令示例，在容器内的空源码目录执行：

```bash
mkdir -p /workspace/src

git init /workspace/src/vllm
git -C /workspace/src/vllm fetch --depth 1 \
  https://github.com/vllm-project/vllm.git \
  5df63a7203cdb9328d824a27b682e77c7b9928be
git -C /workspace/src/vllm checkout --detach FETCH_HEAD

git init /workspace/src/vllm-ascend
git -C /workspace/src/vllm-ascend fetch --depth 1 \
  https://github.com/vllm-project/vllm-ascend.git \
  d0159b92738cbbdf8680b266c8fc604fb9cf1ef2
git -C /workspace/src/vllm-ascend checkout --detach FETCH_HEAD
```

这里获取的是该提交对应的完整源码快照，包含当时 PR 的全部修改。已有实验环境直接核验版本即可，无需重新 checkout：

```bash
# 在服务器宿主机执行；该目录映射为容器内的 /workspace。
WORK=/path/to/dsv41-pr19284  # 替换为实际宿主机工作目录
git -C "$WORK/src/vllm" log -1 --format='%H %s'
git -C "$WORK/src/vllm-ascend" log -1 --format='%H %s'
```

本次 release 基线还补充了一个 PP 兼容补丁，使非首流水阶段能够保留模型需要的原始 token ID。补丁涉及 vLLM 的 `model_runner.py` 和 `cudagraph_utils.py`，W4A8 的 DP、PP 测试均使用同一补丁环境。因此，本文的实验版本为“固定 PR 提交 + vLLM release 基线 + PP 兼容补丁”；记录 commit 的同时，也需要保留本地补丁。本次实验记录将该补丁描述为对上游支持的回移。复现时应同时保留并核对补丁 diff，不能仅依据两个 commit SHA 判断环境完全一致。

#### （3）安装依赖并编译推理框架

源码固定后，在 CANN 容器中安装 PyTorch、torch-npu 及相关依赖，再编译安装 vLLM 和 vllm-ascend。考虑到服务器在线下载较慢，本次将适配 Python 3.12、Linux ARM64 的依赖准备为离线包，按固定版本清单安装。

本次将离线包和自备的 `install_offline.sh` 放在 `/workspace/offline-inference`。以下是原环境的构建调用方式；该安装脚本、离线包及 PP 兼容补丁未随本文提供，需要自行准备，不能把这些命令当作通用的一键安装流程。准备完成后，在宿主机执行：

```bash
# 原环境构建命令；已配置好的 W4A8 容器无需重复安装。
docker exec -it dsv41-pr19284 \
  bash /workspace/offline-inference/install_offline.sh dependencies
docker exec -it dsv41-pr19284 \
  bash /workspace/offline-inference/install_offline.sh build
```

安装脚本先检查依赖包和源码版本，再完成依赖安装与算子编译。其中 vLLM 使用 `empty` 后端安装，昇腾设备支持由 vllm-ascend 和 torch-npu 提供；vllm-ascend 开启自定义算子编译。安装完成后通过 `pip check` 检查依赖关系，并保存 `pip freeze`，便于后续核对软件版本。

![离线构建完成后的环境与依赖版本记录](/images/ascend-a3-deployment/image-3.png)

#### （4）验证环境并进入实验

环境准备完成后，先使用 `npu-smi` 确认容器可以识别 16 个逻辑 NPU，再检查框架版本，并进行 BF16 矩阵乘法及多卡通信验证。本次基础计算、全局归约、TP 分组归约和 PP 收发检查均已通过，随后进入模型加载、服务启动及性能精度测试。

## 启动服务与测试方法

以下以 W4A8 实验为主，依次完成服务启动、DP/PP 的 TTFT 对比和一套全量精度评测。两种拓扑使用相同的权重、固定源码及兼容补丁，依次运行，切换前释放上一组服务占用的设备。

### （1）启动模型服务并对齐参数

部署参考[官方教程 5.1：单节点共置部署中的 A3 系列配置](https://docs.vllm.ai/projects/ascend/zh-cn/latest/tutorials/models/DeepSeek-V4.1-Flash.html#51)，Prefill 与 Decode 在同一台 A3 上运行。下面保留该示例的主要启动参数，并按本次实验调整模型路径、监听地址及缓存统计选项；代码为实验启动命令的精简整理，省略日志和来源校验部分。执行位置为已加载 CANN/ATB 环境的容器内。

```bash
export VLLM_USE_V2_MODEL_RUNNER=1
export VLLM_ENGINE_READY_TIMEOUT_S=36000
export PYTORCH_NPU_ALLOC_CONF=expandable_segments:True
export HCCL_BUFFSIZE=1024
export HCCL_OP_EXPANSION_MODE=AIV

vllm serve /model \
  --host 127.0.0.1 --port 8900 --served-model-name dsv41 \
  --data-parallel-size 4 --data-parallel-size-local 4 \
  --tensor-parallel-size 4 --pipeline-parallel-size 1 \
  --enable-expert-parallel \
  --max-model-len 150000 --max-num-batched-tokens 8192 \
  --max-num-seqs 32 --gpu-memory-utilization 0.9 --block-size 128 \
  --tokenizer-mode deepseek_v41 --reasoning-parser deepseek_v41 \
  --tool-call-parser deepseek_v41 --enable-auto-tool-choice \
  --quantization ascend --safetensors-load-strategy lazy \
  --engram-config '{"cpu_offload":true,"dp_shared_memory":true}' \
  --async-scheduling --enable-chunked-prefill \
  --enable-prefix-caching --swa-bounded-replay \
  --compilation-config '{"cudagraph_mode":"FULL_DECODE_ONLY"}' \
  --seed 2026 --generation-config vllm \
  --limit-mm-per-prompt '{"image":0}' --enable-prompt-tokens-details \
  --additional-config '{
    "ascend_compilation_config":{
      "enable_npugraph_ex":true,"enable_static_kernel":false
    },
    "enable_cpu_binding":true,
    "enable_fused_mc2":1,
    "enable_shared_expert_dp":true,
    "enable_flashcomm1":false
  }'
```

关键参数与本次实验的对应关系如下。部署参数按实验时参考的教程整理，实际软件版本以前文固定提交和本地补丁为准。

| 参数 / 配置 | 本次取值与作用 |
|---|---|
| DP / TP / PP | 官方 A3 示例为 DP4TP4；本次基线为 DP4/TP4/PP1，另测试 DP1/TP4/PP4。两组均启用专家并行 EP。 |
| `max-model-len=150000` | 与官方一致，限制单个请求输入与输出的总长度，覆盖 128K 输入及精度生成预算。 |
| `max-num-batched-tokens=8192` | 与官方一致，限制每次调度的 token 数；长输入通过分块预填充分批处理，不要求整个输入小于 8192。 |
| `max-num-seqs=32` | 与官方一致，为每个引擎的序列调度上限；客户端实际并发为 4 或 8。 |
| 显存比例 / 缓存块 | 与官方一致，`gpu-memory-utilization=0.9`、`block-size=128`，分别控制设备内存预算比例和 KV 缓存块粒度。 |
| Engram | 按官方启用 CPU offload；DP 开启 `dp_shared_memory`，PP 配置下关闭该项。 |
| 图模式与优化 | 对齐 MRV2、`FULL_DECODE_ONLY`、异步调度及上述附加配置；开启 NPUGraphEx、CPU 绑定、fused MC2 和共享专家 DP 优化，关闭 static kernel 与 FlashComm1。 |
| 缓存与实验附加项 | 保留官方 SWA bounded replay，显式启用前缀缓存、分块预填充和命中详情；模型路径改为 `/model`，监听改为本机 `127.0.0.1:8900`，固定 seed 并限定纯文本输入。 |

测试 PP4TP4 时，将 DP 和 local DP 均改为 1、PP 改为 4，TP 保持 4；同时设置 `VLLM_PP_LAYER_PARTITION=10,10,10,10`，将 40 层均分为四阶段，并将 Engram 的 `dp_shared_memory` 改为 `false`。其他公共参数保持一致。PP 是本次拓扑适配，且固定版本在 PP>1 时不启用专属 decoder-layer replay 优化，因此相同缓存命中率不代表两组计算路径完全相同。

等待权重加载及图编译完成后，检查接口，再用少量请求验证生成和答案解析。宿主机上的健康检查命令如下，返回 HTTP 200 后继续进行请求验证：

```bash
curl --noproxy '*' --max-time 5 -sS -o /dev/null \
  -w 'HTTP %{http_code}\n' http://127.0.0.1:8900/health
```

若容器未使用 host 网络，上述宿主机地址需要替换为实际映射地址，或直接在容器内执行检查。

![服务启动日志与 HTTP 200 健康检查](/images/ascend-a3-deployment/image-5.png)

### （2）执行 TTFT 性能测试

先准备公共前缀缓存，再发送正式请求。DP 模式下分别预热四个 DP 引擎，正式请求使用正常负载均衡；每轮采用独立 cache salt，避免沿用上一轮缓存。通过响应中的 `cached_tokens/prompt_tokens` 核对实际逻辑命中率。

| 场景 | 输入 tokens | 并发 | 输出 tokens | 命中 tokens / 命中率 |
|---|---:|---:|---:|---|
| 16K | 16,384 | 4 | 1 | 14,720 / 89.84375% |
| 128K | 131,072 | 8 | 1 | 117,888 / 89.94141% |

每种拓扑、每个场景测 3 轮，每轮 256 个正式请求，预热样本不计入。请求按批并发发送，整批完成后再发下一批；TTFT 从客户端发起请求计时，到收到首个生成 token 的 SSE 事件结束。保存逐请求时延、缓存命中和结束状态，统计各轮及合并 768 个样本的 Mean、P50、P95、P99；合并分位数由原始样本重算。

### （3）执行精度评测并汇总结果

使用固定 AISBench 的 0-shot CoT 模板和评分规则，通过 HTTP 客户端运行 GSM8K test 1,319 题与 GPQA Diamond 198 题。正式采样设置为 `temperature=1.0`、`top_p=1.0`、`seed=2026`、`reasoning_effort=low`，并发 4，最大输出预算 131,072 tokens；先核对题目输入与生成预算能够容纳于 150,000 的上下文中。

精度请求使用独立 cache salt 隔离题间缓存，仅对最终回答评分，空答和解析失败计错，并检查是否发生长度截断或请求错误。最终保留一套 DP4TP4 全量精度，取消重复的 PP 精度测试。所有性能与精度原始结果保存后独立复核，再汇总为下文表格。

## W4A8 的性能与精度结果

本次使用 DeepSeek-V4.1-Flash-1017-W4A8 权重，在同一软件环境下对比 DP4TP4 与 PP4TP4，并使用 DP4TP4 完成一套全量精度评测。

### TTFT 性能

输入长度分别为 16K（16,384 tokens）和 128K（131,072 tokens），并发分别为 4 和 8，输出均为 1 token，实际逻辑缓存命中率约为 90%。每组完成 3 轮、每轮 256 个正式请求；下表由合计 768 个原始样本统计，预热不计入，正式请求均无失败。

| 配置 / 场景 | Mean ms | P50 ms | P95 ms | P99 ms | 实际逻辑命中率 |
|---|---:|---:|---:|---:|---:|
| DP4TP4：16K / 4并发 | 527.59 | 522.97 | 787.29 | 904.18 | 89.84375% |
| PP4TP4：16K / 4并发 | 717.60 | 696.24 | 1118.71 | 1131.02 | 89.84375% |
| DP4TP4：128K / 8并发 | 3261.76 | 3244.01 | 4194.45 | 4233.35 | 89.94141% |
| PP4TP4：128K / 8并发 | 5626.99 | 5905.73 | 8369.14 | 8400.27 | 89.94141% |

在本次两个缓存场景下，DP4TP4 的平均 TTFT 均更低：16K 场景中，PP 比 DP 高 **36.01%**；128K 场景中，PP 比 DP 高 **72.51%**。该结果反映所测负载下的首 token 延迟，不能直接推广到吞吐量或长回答的总生成时间。

### 答题准确率

采用 0-shot CoT，设置 `temperature=1.0`、`top_p=1.0`、`seed=2026`、`reasoning_effort=low`，并发为 4，最大生成预算为 131,072 tokens。使用固定 AISBench 提示模板及评分规则，仅对最终回答评分；精度请求不复用上述 TTFT 测试的约 90% 缓存场景。

| 配置 | 数据集 | 正确数 / 总题数 | 准确率 |
|---|---|---:|---:|
| DP4TP4 | GSM8K test | 1267 / 1319 | **96.06%** |
| DP4TP4 | GPQA Diamond | 175 / 198 | **88.38%** |

共 1,517 题全部自然结束，无长度截断或请求错误，原始输出经独立复核。GSM8K 的 3 个空答、1 个解析失败及 GPQA 的 5 个解析失败均计错，保留完整分母。PP 的重复精度评测已取消，部分结果不纳入正式成绩。因此，W4A8 部分只能报告 DP 的精度，不能据此比较两种拓扑的精度差异。

![W4A8 DP4TP4 的 GPQA Diamond 评测汇总：175 道正确，准确率 88.38%](/images/ascend-a3-deployment/image-6.png)

## W8A8_DYNAMIC 的补充测试

W8A8_DYNAMIC 使用固定长度的合成 token ID 输入，输出 1 个 token；16K 为 16,384 tokens，128K 为 131,072 tokens。每个场景完成 3 轮，每轮 256 个正式请求，预热不计入；请求按批并发发送，整批完成后再发下一批。

TTFT 从客户端发起 POST 到收到首个生成 token 的 SSE 事件，包含本机通信，不包含输入构造和序列化。P50 为中位数，P95/P99 采用 nearest-rank，汇总时直接合并 768 个样本。表中 v2 沿用原始实验批次标记。

### TTFT 性能

| 配置 / 场景 | 正式样本 | Mean ms | P50 ms | P95 ms | P99 ms | 实际命中率 |
|---|---:|---:|---:|---:|---:|---:|
| DP4TP4：16K无缓存 / 4并发 | 768 | 4472.75 | 4376.83 | 8266.05 | 9491.25 | 0% |
| PP4TP4：16K无缓存 / 4并发 | 768 | 3027.02 | 3328.82 | 4178.08 | 4224.26 | 0% |
| DP4TP4：16K缓存复用 / 4并发 | 768 | 1242.74 | 1018.06 | 1745.71 | 2425.97 | 89.84375% |
| PP4TP4：16K缓存复用 / 4并发 | 768 | 1104.80 | 1141.91 | 1556.55 | 1653.01 | 89.84375% |
| DP4TP4：128K / 8并发（v2） | 768 | 4506.61 | 4554.21 | 6107.92 | 6196.40 | 89.9414% |
| PP4TP4：128K / 8并发（v2） | 768 | 6061.43 | 6526.18 | 8951.23 | 9220.00 | 89.9414% |

### 答题准确率

使用固定 AISBench 数据、模板和评分函数，通过自定义 HTTP 执行器测量。采用 0-shot CoT，设置 `temperature=0`、`reasoning_effort=low`，并发为 4。GSM8K 和 GPQA 的生成上限分别为 32,768、65,536 tokens（含推理 token），仅对最终回答评分。

| 配置 | GSM8K test | GPQA Diamond |
|---|---:|---:|
| DP4TP4 | 1285/1319，**97.42%** | 175/198，**88.38%** |
| PP4TP4 | 1284/1319，**97.35%** | 176/198，**88.89%** |

每个拓扑各进行一次完整评测，两侧均完成 GSM8K 1,319 题和 GPQA Diamond 198 题，无 HTTP 或协议失败。GPQA 中 DP 有 10 题、PP 有 8 题达到生成上限而截断，全部计错并保留固定分母。

PP 相对 DP 在 GSM8K 上少答对 1 题，在 GPQA 上多答对 1 题，准确率分别相差约 −0.076 和 +0.505 个百分点。单次评测的一题差异不足以说明某种拓扑具有稳定的精度优势。

## 结论与复现注意事项

**W4A8 的两个高缓存命中场景中，DP4TP4 的首 token 延迟更低。** 16K 输入、并发 4 时，DP 平均 TTFT 为 527.59 ms；128K 输入、并发 8 时为 3261.76 ms。PP 的平均延迟相对分别高出 36.01% 和 72.51%。这些结果描述的是当前配置下的首 token 延迟，不能替代完整输出的吞吐与总耗时测试。

**W8A8_DYNAMIC 的结果随输入场景变化。** 16K 无缓存与缓存复用场景下，PP 的平均 TTFT 都更低；到 128K 缓存复用场景，DP 更低。两套量化配置呈现的趋势不同，因此部署时需要按实际输入长度、并发和缓存行为测试，不能只凭某一行成绩确定并行方案。

**W4A8 与 W8A8 的准确率不构成严格的量化对照。** 前者使用 `temperature=1.0`，后者使用 `temperature=0`，生成预算也不同；W4A8 只有 DP 的正式精度结果，而 W8A8 同时测试了 DP 和 PP。比较量化影响前，还需要对齐采样设置、生成上限与完整软件配置。

复现时，除了模型权重和代码提交，还应记录 PP 兼容补丁、依赖清单、启动参数、压测与评测脚本，以及逐请求的缓存命中和结束状态。本文保留部署命令和汇总数据；原始逐请求数据、评测脚本及离线安装材料需另行准备。尤其在比较 DP 和 PP 时，相同的逻辑缓存命中率并不保证底层计算路径相同。
