import MobileView from "./views/mobile";
import DesktopView from "./views/desktop";

function App() {
  const isMobile = /Mobi|Android/i.test(navigator.userAgent);
  return isMobile ? <MobileView /> : <DesktopView />;
}

export default App;
