// Recognize only the empty bibliography anchors in the supplied Markdown.
// Raw HTML elsewhere stays disabled; no arbitrary HTML is executed.
export default function referenceAnchors() {
  return tree => {
    const walk = node => {
      if (!node.children) return;
      node.children = node.children.map(child => {
        if (child.type === 'raw') {
          const match = /^<a id="(ref-\d+)">(?:<\/a>)?$/.exec(child.value);
          if (match) return { type: 'element', tagName: 'span', properties: { id: match[1] }, children: [] };
          if (child.value === '</a>') return { type: 'text', value: '' };
        }
        walk(child);
        return child;
      });
    };
    walk(tree);
  };
}
