import './navigation.css';

export default function BottomNav() {
  const items = ['持仓', '行情', '波段', '资讯', '我的'];

  return (
    <nav className="bottom-nav">
      {items.map((item, i) => (
        <button key={item} className={i === 0 ? 'active' : ''}>
          {item}
        </button>
      ))}
    </nav>
  );
}
