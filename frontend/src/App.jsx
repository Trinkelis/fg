import Header          from './components/Header.jsx';
import Sidebar         from './components/Sidebar.jsx';
import Preview         from './components/Preview.jsx';
import CommandBar      from './components/CommandBar.jsx';
import ProgressOverlay from './components/ProgressOverlay.jsx';
import useStore        from './store/useStore.js';

export default function App() {
  const isProcessing = useStore(s => s.isProcessing);
  return (
    <div className="app">
      <Header />
      <div className="main-layout">
        <Sidebar />
        <Preview />
      </div>
      <CommandBar />
      {isProcessing && <ProgressOverlay />}
    </div>
  );
}
