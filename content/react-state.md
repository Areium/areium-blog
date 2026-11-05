当一个组件变得越来越复杂时，问题往往不在代码行数，而在于同一份数据被放在了太多地方。

## 从一个搜索框开始

假设页面上有一个文章列表，以及用于筛选标题的搜索框。真正需要记录的只有用户输入的关键词；筛选结果可以直接计算。

```jsx
function ArticleList({ articles }) {
  const [query, setQuery] = useState('');
  const visible = articles.filter(article =>
    article.title.includes(query)
  );

  return (
    <>
      <input value={query}
        onChange={event => setQuery(event.target.value)} />
      {visible.map(article => (
        <h2 key={article.id}>{article.title}</h2>
      ))}
    </>
  );
}
```

这里不需要额外保存 `visible`，也就不必同步两份状态。示例中的 `useState` 需要从 React 导入。

## 让状态靠近使用它的地方

如果展开与收起只影响一张卡片，就把这个状态留在卡片里。当两个组件需要协作，再把状态提升到它们最近的共同父组件。

> 先让数据流清楚，再考虑如何抽象。

| 数据 | 建议位置 |
| --- | --- |
| 卡片是否展开 | 卡片内部 |
| 多组件共享的筛选条件 | 共同父组件 |
| 从其他数据计算出的结果 | 渲染时计算 |

## 写之前先问三个问题

1. 这个值能从现有数据计算出来吗？
2. 哪些组件真的需要读写它？
3. 页面刷新后，它还需要保留吗？

这些问题可以帮助我们区分交互状态、服务端数据以及应该放进 URL 的筛选条件。

## 留一点空间给变化

不必一开始就引入复杂的状态方案。先用一个简单页面验证数据流，遇到真实的共享需求，再逐步调整边界。

这篇示例展示了代码、表格、引用与目录。替换这个 Markdown 文件，就可以发布你自己的技术文章。
