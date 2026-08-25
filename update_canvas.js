const fs = require('fs');
let code = fs.readFileSync('src/components/Canvas.tsx', 'utf8');

// 1. Add `isLoaded` and autosave logic
code = code.replace(
  `const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);`,
  `const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('bernie-autosave');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.nodes && parsed.nodes.length > 0) setNodes(parsed.nodes);
        else setNodes(initialNodes);
        
        if (parsed.edges) setEdges(parsed.edges);
      } catch {
        setNodes(initialNodes);
      }
    } else {
      setNodes(initialNodes);
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    const timeout = setTimeout(() => {
      localStorage.setItem('bernie-autosave', JSON.stringify({ nodes, edges }));
    }, 1000);
    return () => clearTimeout(timeout);
  }, [nodes, edges, isLoaded]);`
);

// 2. Add connectionRadius to ReactFlow
code = code.replace(
  `snapToGrid={snapToGrid}`,
  `snapToGrid={snapToGrid}
          connectionRadius={50}`
);

fs.writeFileSync('src/components/Canvas.tsx', code);
