const fs = require('fs');
let code = fs.readFileSync('src/components/CommandPalette.tsx', 'utf8');

code = code.replace(
  `const toggleHandles = () => {
    document.body.classList.toggle('show-vertical-handles');
    setIsOpen(false);
  };`,
  `const toggleHandles = () => {
    const isShowing = document.body.classList.toggle('show-vertical-handles');
    localStorage.setItem('bernie-show-handles', isShowing ? 'true' : 'false');
    setIsOpen(false);
  };

  useEffect(() => {
    if (localStorage.getItem('bernie-show-handles') === 'true') {
      document.body.classList.add('show-vertical-handles');
    }
  }, []);`
);

fs.writeFileSync('src/components/CommandPalette.tsx', code);
