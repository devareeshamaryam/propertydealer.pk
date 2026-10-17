/*
 * Default titles and descriptions for the e-map pages, written for what people
 * search: "<society> map", "<society> <city> map", "<society> master plan",
 * "<society> location", "<city> society map", "e map <city>".
 *
 * Only defaults: a society's own Meta Title / Meta Description (Dashboard →
 * Society Maps) and a city page's (Dashboard → Static Pages, slug
 * "emap-<city>") take precedence. Titles stay near 60 characters and
 * descriptions near 155, so search results show them whole.
 */

import type { SocietyMapPage } from '@/lib/society-map';

const fit = (text: string, max: number) => (text.length <= max ? text : `${text.slice(0, max - 1).replace(/\s+\S*$/, '')}…`);

export function societyMapMeta(s: SocietyMapPage): { title: string; description: string } {
  const plan = s.kind === 'plan' || s.kind === 'document';
  const tail = plan ? 'Master Plan & Location Map' : 'Location Map & Blocks';
  const candidates = [
    `${s.name} ${s.cityName} Map — ${tail}`,
    `${s.name} Map ${s.cityName} — ${plan ? 'Master Plan' : 'Location'}`,
    `${s.name} Map — ${plan ? 'Master Plan' : 'Location'}`,
  ];
  const title = s.seo.metaTitle || candidates.find((t) => t.length <= 62) || fit(candidates[2]!, 62);

  const parts = [
    `${s.name} ${s.cityName} map`,
    plan ? 'with the official master plan' : 'with its location',
    s.blocks.length ? `${s.blocks.length} blocks` : '',
    s.plotCount ? 'plot numbers' : '',
  ].filter(Boolean);
  const official = s.official?.authority && s.official.status !== 'illegal' ? ` ${s.official.authority} approval details,` : '';
  const description =
    s.seo.metaDescription ||
    fit(`${parts.join(', ')} on satellite.${official} Property for sale and rent in ${s.name}.`.replace(/\s+/g, ' '), 158);
  return { title, description };
}

export function cityMapMeta(cityName: string, societies: number): { title: string; description: string } {
  const title = fit(`${cityName} Society Maps — Housing Schemes Map of ${cityName}`, 62);
  const description = fit(
    `${cityName} e-map: ${societies ? `${societies} ` : ''}housing society maps with master plans, locations and blocks on satellite, plus property for sale and rent in ${cityName}.`,
    158,
  );
  return { title, description };
}

export const EMAP_INDEX_META = {
  title: 'E-Map Pakistan — Housing Society Maps & Master Plans',
  description:
    'E-map of Pakistan: housing society maps and master plans for Lahore, Karachi, Islamabad, Rawalpindi, Faisalabad and more — with plots and property on satellite.',
};
