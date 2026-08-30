import './navigation.css';

export default function BottomNav() {
  const items = ['持仓', '行情', '波段', '资讯', '我的'];
  return (
    <nav className="bottom-nav" aria-hidden="true">
      {items.map((item) => (
        <button key={item} tabIndex={-1}>{item}</button>
      ))}
    </nav>
  );
}
