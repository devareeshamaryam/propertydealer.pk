/*
 * The admin's Discord alerts — every kind, with what it says and its switch
 * (site setting `notify<Key>`). Mirrors NOTIFY_CATEGORIES in the API.
 */

export const NOTIFY_KINDS = [
  { key: 'Listings', icon: '🕵️', label: 'Listings waiting for review', hint: 'A new listing held for approval, or a live one pulled back after an edit — photo, price, place, risk score, why, the agent, Review / Edit links.' },
  { key: 'ListingsAuto', icon: '✅', label: 'Listings published without review', hint: 'Trusted agents whose listings go live at once. Turn off if it is too many.' },
  { key: 'ListingChanges', icon: '🤝', label: 'Sold, rented or deleted listings', hint: 'An agent marks a listing sold or rented, or a listing is deleted — and by whom.' },
  { key: 'Accounts', icon: '👤', label: 'New accounts', hint: 'Every sign-up (email or Google), with name, email and phone.' },
  { key: 'Payments', icon: '💳', label: 'Plans & payments', hint: 'A plan bought, a payment to verify (with the screenshot), verified, rejected, granted or cancelled.' },
  { key: 'Orders', icon: '🧱', label: 'Material orders', hint: 'Items, total, address, phone — with a WhatsApp link to the customer.' },
  { key: 'Reports', icon: '🚩', label: 'Reports', hint: 'A listing or agent reported: reason, both people, open reports on that agent.' },
  { key: 'Team', icon: '👥', label: 'Agency teams', hint: 'An agency adds or removes an agent account.' },
  { key: 'Places', icon: '📍', label: 'New areas & cities', hint: 'An agent adds an area or city that was not there — check the spelling or merge it.' },
  { key: 'Security', icon: '🔒', label: 'Security', hint: 'An account locked after wrong passwords; a role changed, an account deactivated or deleted, a new admin.' },
  { key: 'Errors', icon: '💥', label: 'Server errors', hint: 'Something broke on the server — the route and the message, once per 30 minutes per error.' },
  { key: 'Digest', icon: '📊', label: 'Daily report (9 am)', hint: 'Yesterday in numbers — accounts, listings, leads, orders — and what is waiting: reviews, payments, reports, plans ending this week.' },
] as const;

export type NotifyKind = (typeof NOTIFY_KINDS)[number]['key'];

export type NotifySettings = { [K in NotifyKind as `notify${K}`]: boolean };

export const DEFAULT_NOTIFY_SETTINGS = Object.fromEntries(NOTIFY_KINDS.map((k) => [`notify${k.key}`, true])) as NotifySettings;
