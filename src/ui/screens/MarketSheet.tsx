import { useState } from 'react';
import { ORDER_MAX, type GoodView, type MarketView } from '../../engine';

// The Market screen (design doc §7): prices in the player's market, goods held, standing orders, and
// last turn's trades. Orders are placed in the trade phase.

export interface MarketTrade {
  resource: string;
  side: 'buy' | 'sell';
  count: number;
  price: number;
}

interface MarketSheetProps {
  view: MarketView;
  treasury: number;
  // Players in the market by name, the player first.
  members: string[];
  // The trade phase is open and the player has not ended it.
  canOrder: boolean;
  // This turn's trades, after the trade phase closes.
  trades: MarketTrade[];
  onOrder: (resource: string, side: 'buy' | 'sell', count: number, limit?: number) => void;
}

export function MarketSheet({ view, treasury, members, canOrder, trades, onOrder }: MarketSheetProps) {
  const others = members.slice(1);
  return (
    <div className="civ-sheet">
      <header className="civ-head">
        <h1>Market</h1>
        <p>Treasury {treasury}</p>
      </header>

      {!view.access ? (
        <p className="civ-note">No market access. Barter Developed opens the market; until then nothing can be bought or sold (§7).</p>
      ) : (
        <>
          <p className="mk-members" title={`Players with market access whose settlements are within ${view.reach} steps of yours, or yours of theirs; their orders move your prices (§7)`}>
            {!view.trading ? 'You need a settlement to trade from.' : others.length > 0 ? `Your market: you, ${others.join(', ')} · reach ${view.reach}` : `Your market: you alone · reach ${view.reach}`}
          </p>
          <table className="civ-table mk-table">
            <thead>
              <tr>
                <th title="Food covers support anywhere in your civilization; luxuries calm (§6)">Good</th>
                <th title="What orders fill at now; it starts at food 5, luxury 10 and stays between half and triple">Price</th>
                <th title="The price at the close of the trade phase from the standing orders in your market: 10% of the starting price per unit bought minus sold">At close</th>
                <th title="Goods gathered this turn, plus stored grain, that you can sell">Held</th>
                <th>Order</th>
              </tr>
            </thead>
            <tbody>
              {view.goods.map((g) => (
                <GoodRow key={g.resource} good={g} canOrder={canOrder && view.trading} onOrder={onOrder} />
              ))}
            </tbody>
          </table>
          {trades.length > 0 && (
            <section className="mk-trades">
              <h2>This turn</h2>
              <ul>
                {trades.map((t, i) => (
                  <li key={i}>
                    {t.side === 'buy' ? 'Bought' : 'Sold'} {t.count} {view.goods.find((g) => g.resource === t.resource)?.name.toLowerCase() ?? t.resource} at {t.price} · {t.side === 'buy' ? '−' : '+'}
                    {t.count * t.price}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <p className="civ-note">Orders stand every turn until changed. Sales fill first, then purchases as far as the treasury allows. Bought goods reach every settlement.</p>
        </>
      )}
    </div>
  );
}

function GoodRow({ good, canOrder, onOrder }: { good: GoodView; canOrder: boolean; onOrder: MarketSheetProps['onOrder'] }) {
  const [side, setSide] = useState<'buy' | 'sell'>(good.order?.side ?? 'buy');
  const [count, setCount] = useState(String(good.order?.count ?? 1));
  const [limit, setLimit] = useState(good.order?.limit === undefined ? '' : String(good.order.limit));
  const moved = good.forecast - good.price;
  const kind = good.food ? 'food' : good.luxury ? 'luxury' : 'good';
  const n = Number(count);
  const valid = Number.isInteger(n) && n >= 1 && n <= ORDER_MAX && (limit === '' || (Number.isInteger(Number(limit)) && Number(limit) > 0)) && (side === 'buy' || good.canSell);
  return (
    <tr>
      <td>
        {good.name} <small className="mk-kind">{kind}</small>
      </td>
      <td className="civ-num" title={`Starts at ${good.start}; between ${good.min} and ${good.max}`}>
        {good.price}
      </td>
      <td className="civ-num" title={good.imbalance === 0 ? 'No orders in your market move it' : `${good.imbalance > 0 ? `${good.imbalance} more bought than sold` : `${-good.imbalance} more sold than bought`} in your market`}>
        {good.forecast}
        {moved !== 0 && <small className={moved > 0 ? 'mk-up' : 'mk-down'}> {moved > 0 ? `+${moved}` : moved}</small>}
      </td>
      <td className="civ-num">{good.held}</td>
      <td className="mk-order">
        {good.order && (
          <span className="mk-standing">
            {good.order.side === 'buy' ? 'Buy' : 'Sell'} {good.order.count}
            {good.order.limit !== undefined ? ` at ${good.order.side === 'buy' ? 'most' : 'least'} ${good.order.limit}` : ' at market'}
          </span>
        )}
        {canOrder && (
          <span className="mk-edit">
            <select value={side} onChange={(e) => setSide(e.target.value as 'buy' | 'sell')} aria-label={`${good.name}: buy or sell`}>
              <option value="buy">Buy</option>
              <option value="sell" disabled={!good.canSell} title={good.canSell ? undefined : 'You can sell only goods you can use'}>
                Sell
              </option>
            </select>
            <input type="number" min={1} max={ORDER_MAX} value={count} onChange={(e) => setCount(e.target.value)} aria-label={`${good.name}: units`} />
            <input
              type="number"
              min={1}
              placeholder="market"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              aria-label={`${good.name}: price limit`}
              title={side === 'buy' ? 'Highest price you will pay; empty buys at the market price' : 'Lowest price you will accept; empty sells at the market price'}
            />
            <button type="button" disabled={!valid} onClick={() => onOrder(good.resource, side, n, limit === '' ? undefined : Number(limit))}>
              {good.order ? 'Change' : 'Place'}
            </button>
            {good.order && (
              <button type="button" onClick={() => onOrder(good.resource, good.order!.side, 0)}>
                Cancel
              </button>
            )}
          </span>
        )}
      </td>
    </tr>
  );
}
