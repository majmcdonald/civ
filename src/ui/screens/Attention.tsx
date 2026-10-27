import { tierRules, type AreaId, type AttentionItem, type Content } from '../../engine';

// The attention list (design doc §3, v0.29): what will be lost, wasted, or risked if the turn ends
// now. Each line opens the screen or map area where it is fixed.

export type AttentionScreen = 'map' | 'civilization' | 'economy' | 'society';

interface Names {
  content: Content;
  place: (area: AreaId) => string;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export function attentionText(item: AttentionItem, { content, place }: Names): string {
  const wonder = (id: string) => content.wonders.find((w) => w.id === id)?.name ?? id;
  const good = (id: string) => (content.resources.find((r) => r.id === id)?.name ?? id).toLowerCase();
  switch (item.type) {
    case 'idle':
      return `${place(item.area)}: ${plural(item.units, 'manpower')} idle`;
    case 'support':
      return `${place(item.area)} will ${item.tier === 'village' ? 'dissolve' : 'drop a tier'}: support ${item.support} of ${item.needed}`;
    case 'collapse':
      return `${place(item.area)}: instability ${item.instability} of ${item.threshold}, close to collapse`;
    case 'wonderStall':
      return `${wonder(item.wonder)} will stall: ${item.reason}`;
    case 'raceLost':
      return `${wonder(item.wonder)} completed by a rival: move your ${plural(item.worked, 'turn')} or take culture`;
    case 'conversion': {
      const p = item.preview;
      const name = tierRules(p.tier).name.toLowerCase();
      if (!p.built) return `${name.charAt(0).toUpperCase() + name.slice(1)} at ${place(item.area)} will not be built: ${p.reason ?? 'not enough tokens'}`;
      if (p.support < p.needed) return `New ${name} at ${place(item.area)}: support ${p.support} of ${p.needed}, it will ${p.tier === 'village' ? 'dissolve' : 'drop a tier'}`;
      return `New ${name} at ${place(item.area)}: ${plural(p.leftover, 'token')} left in the area will be removed`;
    }
    case 'overLimit':
      return `${place(item.area)}: ${plural(item.count, 'token')} over the area limit will be removed`;
    case 'overCap':
      return `${plural(item.count, 'token')} over the token cap will be removed`;
    case 'order':
      return `Buy ${item.count} ${good(item.resource)}: the treasury covers ${item.affordable}`;
    case 'fight':
      return `Your tokens enter a fight at ${place(item.area)}`;
    case 'buyOff':
      return `${content.calamities.find((c) => c.id === item.calamity)?.name ?? item.calamity} marked to buy off: treasury ${item.treasury} of ${item.cost}`;
  }
}

// Where the player fixes it: an area on the map, or a screen.
export function attentionTarget(item: AttentionItem): { area: AreaId } | { screen: AttentionScreen } {
  switch (item.type) {
    case 'idle':
    case 'support':
    case 'collapse':
    case 'conversion':
    case 'overLimit':
    case 'fight':
      return { area: item.area };
    case 'wonderStall':
    case 'raceLost':
      return { screen: 'society' };
    case 'overCap':
      return { screen: 'civilization' };
    case 'order':
      return { screen: 'economy' };
    case 'buyOff':
      return { screen: 'civilization' };
  }
}

interface AttentionListProps extends Names {
  items: AttentionItem[];
  onOpen: (item: AttentionItem) => void;
  onClose: () => void;
}

export function AttentionList({ items, content, place, onOpen, onClose }: AttentionListProps) {
  return (
    <div className="game-attention-list" role="dialog" aria-label="To address">
      <h2>{items.length === 0 ? 'Nothing to address' : `${plural(items.length, 'thing')} to address`}</h2>
      {items.length === 0 ? (
        <p className="civ-note">Nothing will be lost if you end the turn now.</p>
      ) : (
        <ul>
          {items.map((item, i) => (
            <li key={i}>
              <button type="button" onClick={() => onOpen(item)}>
                {attentionText(item, { content, place })}
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="game-attention-close" onClick={onClose}>
        Close
      </button>
    </div>
  );
}
