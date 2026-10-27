import { useState } from 'react';
import { CURRENCY_PER_MANPOWER, ORDER_MAX, TIERS, type AreaId, type GoodLine, type GoodsLedger, type GoodView, type KindLine, type MarketView, type TreasuryForecast } from '../../engine';

// The Economy screen (design doc §3, Screens and information panels, v0.29): the treasury and what
// it will be next turn, and one table of goods with what is gathered, held, needed, and traded.
// Orders are placed in allocation and fill from next turn's resources phase (§7).

interface EconomySheetProps {
  view: MarketView;
  treasury: TreasuryForecast;
  goods: GoodsLedger;
  // Players in the market by name, the player first.
  members: string[];
  // The allocation phase is open and the player has not ended it.
  canOrder: boolean;
  place: (area: AreaId) => string;
  onOrder: (resource: string, side: 'buy' | 'sell', count: number, limit?: number) => void;
}

const TAXED = TIERS.filter((t) => t.tax > 0);

export function EconomySheet({ view, treasury, goods, members, canOrder, place, onOrder }: EconomySheetProps) {
  const others = members.slice(1);
  const spending = treasury.orders + treasury.wonders;
  const line = (resource: string) => goods.goods.find((g) => g.resource === resource)!;
  const food = view.goods.filter((g) => g.food);
  const luxury = view.goods.filter((g) => g.luxury);
  const other = view.goods.filter((g) => !g.food && !g.luxury);
  const market = view.access && view.trading;
  const row = (g: GoodView) => <GoodRow key={g.resource} good={g} line={line(g.resource)} market={view.access} canOrder={canOrder && market} place={place} onOrder={onOrder} />;

  return (
    <div className="civ-sheet">
      <header className="civ-head">
        <h1>Economy</h1>
        <p>Treasury {treasury.treasury}</p>
      </header>

      <div className="civ-cards">
        <section className="civ-card">
          <h2>Treasury</h2>
          <div className="civ-big">{treasury.treasury}</div>
          <dl className="civ-facts">
            <dt>Tax a turn</dt>
            <dd>+{treasury.tax}</dd>
            {treasury.sales > 0 && (
              <>
                <dt>Sell orders</dt>
                <dd>+{treasury.sales}</dd>
              </>
            )}
            <dt title="Buy orders at current prices, and currency covering missing wonder manpower">Spending a turn</dt>
            <dd>{spending > 0 ? `−${spending}` : 0}</dd>
            {treasury.orders > 0 && (
              <>
                <dt className="ec-part">Buy orders</dt>
                <dd>{treasury.orders}</dd>
              </>
            )}
            {treasury.wonders > 0 && (
              <>
                <dt className="ec-part">Wonder manpower</dt>
                <dd>{treasury.wonders}</dd>
              </>
            )}
            <dt>Expected next turn</dt>
            <dd className={treasury.expected < 0 ? 'ec-short' : ''}>{treasury.expected}</dd>
          </dl>
          {treasury.expected < 0 && <p className="civ-warnings">Orders fill first; a wonder then stalls for want of currency.</p>}
          <p className="civ-rule">
            Tax: {TAXED.map((t) => `${t.name.toLowerCase()} ${t.tax}`).join(', ')} a turn. Currency buys goods on the market, covers missing wonder manpower at {CURRENCY_PER_MANPOWER} a unit, and buys off calamities. It keeps from turn to turn.
          </p>
        </section>

        <section className="civ-card civ-card-wide">
          <h2>Market</h2>
          {!view.access ? (
            <p className="civ-note">No market access. Barter Developed opens the market; until then nothing can be bought or sold.</p>
          ) : (
            <p className="mk-members">{!view.trading ? 'You need a settlement to trade from.' : others.length > 0 ? `Your market: you, ${others.join(', ')} · reach ${view.reach}` : `Your market: you alone · reach ${view.reach}`}</p>
          )}
          <p className="civ-rule">
            Your market is every civilization with market access whose settlements are within reach of yours, or yours of theirs; their orders move your prices. Orders stand every turn until changed and fill in the resources phase, so a change made now fills next turn. Sales fill first, then purchases as far as the treasury allows. Each unit
            bought minus sold moves the price 10% of its starting price, between half and triple. Bought goods reach every settlement.
          </p>
        </section>
      </div>

      <table className="civ-table mk-table ec-goods">
        <thead>
          <tr>
            <th>Good</th>
            <th title="A turn, by your standing assignments">Gathered</th>
            <th title="Held now: gathered this turn, bought, and kept from earlier turns (durable goods and stored grain)">Held</th>
            <th title="Used this turn: food for support and wonders, luxuries for settlements with instability, wonder goods">Needed</th>
            <th title="What orders fill at now">Price</th>
            <th title="The price next turn, when the standing orders in your market fill">Next turn</th>
            {view.access && <th>Order</th>}
          </tr>
        </thead>
        <tbody>
          <KindRow name="Food" note="any kind" kind={goods.food} open={food.some((g) => g.canSell)} detail={kindDetail(goods.food)} columns={view.access ? 3 : 2} />
          {food.map(row)}
          <KindRow name="Luxuries" note="any kind" kind={goods.luxury} open={luxury.some((g) => g.canSell)} detail={goods.luxury.needed > 0 ? `${goods.luxury.needed} settlement${goods.luxury.needed === 1 ? '' : 's'} with instability` : ''} columns={view.access ? 3 : 2} />
          {luxury.map(row)}
          {other.length > 0 && (
            <tr className="ec-kind">
              <td colSpan={view.access ? 7 : 6}>Other goods</td>
            </tr>
          )}
          {other.map(row)}
        </tbody>
      </table>
      <p className="civ-rule ec-legend">
        <b>Food</b> covers support tokens cannot and food for wonders; it spoils at the end of the turn unless stored (Pottery's grain). <b>Luxury</b>: each calms 1 instability on the settlement nearest collapse, at most 1 a settlement. <b>Durable</b> goods (stone, copper, cloth) are kept in your stock from turn to turn; a
        durable luxury is used only where there is instability.
      </p>
    </div>
  );
}

function kindDetail(k: KindLine): string {
  const parts = [k.support ? `support ${k.support}` : '', k.wonders ? `wonders ${k.wonders}` : ''].filter(Boolean);
  return parts.join(', ');
}

// Food and luxuries are interchangeable within their kind, so their need is shown for the kind; a
// shortfall is marked only once the civilization can gather a good of the kind.
function KindRow({ name, note, kind, open, detail, columns }: { name: string; note: string; kind: KindLine; open: boolean; detail: string; columns: number }) {
  return (
    <tr className="ec-kind">
      <td className="ec-kind-name">
        {name} <small className="mk-kind">{note}</small>
      </td>
      <td className="civ-num">{kind.gathered}</td>
      <td className="civ-num">{kind.held}</td>
      <td className={`civ-num ${open && kind.held < kind.needed ? 'ec-short' : ''}`}>
        {kind.needed}
        {detail && <small className="ec-where">{detail}</small>}
      </td>
      <td colSpan={columns} />
    </tr>
  );
}

function GoodRow({ good, line, market, canOrder, place, onOrder }: { good: GoodView; line: GoodLine; market: boolean; canOrder: boolean; place: (area: AreaId) => string; onOrder: EconomySheetProps['onOrder'] }) {
  const [side, setSide] = useState<'buy' | 'sell'>(good.order?.side ?? 'buy');
  const [count, setCount] = useState(String(good.order?.count ?? 1));
  const [limit, setLimit] = useState(good.order?.limit === undefined ? '' : String(good.order.limit));
  const moved = good.forecast - good.price;
  const n = Number(count);
  const valid = Number.isInteger(n) && n >= 1 && n <= ORDER_MAX && (limit === '' || (Number.isInteger(Number(limit)) && Number(limit) > 0)) && (side === 'buy' || good.canSell);
  // Food and luxury needs are the kind's; a good's own need is what wonders name.
  const needed = line.needed > 0 && !good.food;
  return (
    <tr className={good.canSell ? '' : 'ec-closed'} title={good.canSell ? undefined : 'Your civilization cannot gather or use this yet'}>
      <td className="ec-good">
        {good.name} {good.durable && <small className="mk-kind">durable</small>}
      </td>
      <td className="civ-num">
        {line.gathered}
        {line.where.length > 0 && <small className="ec-where">{line.where.map((w) => `${place(w.area)} ${w.count}`).join(', ')}</small>}
      </td>
      <td className="civ-num">
        {line.held}
        {line.kept > 0 && <small className="ec-where">{line.kept} kept</small>}
      </td>
      <td className={`civ-num ${needed && line.held < line.needed ? 'ec-short' : ''}`}>
        {needed ? line.needed : ''}
        {needed && <small className="ec-where">wonders</small>}
      </td>
      <td className="civ-num" title={`Starts at ${good.start}; between ${good.min} and ${good.max}`}>
        {good.price}
      </td>
      <td className="civ-num" title={good.imbalance === 0 ? 'No orders in your market move it' : `${good.imbalance > 0 ? `${good.imbalance} more bought than sold` : `${-good.imbalance} more sold than bought`} in your market`}>
        {good.forecast}
        {moved !== 0 && <small className={moved > 0 ? 'mk-up' : 'mk-down'}> {moved > 0 ? `+${moved}` : moved}</small>}
      </td>
      {market && (
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
      )}
    </tr>
  );
}
