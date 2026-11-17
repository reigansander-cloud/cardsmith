// Template registry - add new templates by adding entries here
export const CARD_TEMPLATES = {
  playing_card: {
    key: 'playing_card',
    label: 'Playing Card',
    description: 'Traditional poker-sized playing card with ornamental frame, corner values, and suit pips',
    defaultData: () => ({
      value: 'A',
      suitIconUrl: '',
      accentColor: '#1a1a2e',
      contentTitle: '',
      content: '',
      frameStyle: 'ornate',
      artworkUrl: '',
      artworkOffset: 0,
      headerText: '',
      abilitiesText: '',
      showHeader: false,
      showAbilities: false,
      showContentTitle: false,
      showContent: false,
      abilitiesIconUrl: '',
      fontFamily: 'CaesarDressing'
    })
  },
  glimpses: {
    key: 'glimpses',
    label: 'Glimpses',
    description: 'Stone-framed card with engraved title, left banner, artwork, and footer rules',
    defaultData: () => ({
      title: '',
      bannerNumber: '',
      bannerIconUrl: '',
      bannerIcon2Url: '',
      artUrl: '',
      footerText: '',
      footerText2: '',
      textless: false
    })
  },
  free_canvas: {
    key: 'free_canvas',
    label: 'Free Canvas',
    description: 'Upload artwork and text boxes, drag to position and resize freely',
    defaultData: () => ({
      elements: []
    })
  },
  seven_wonders: {
    key: 'seven_wonders',
    label: '7 Wonders',
    description: 'Base image card with main artwork and a Greek-style title',
    defaultData: () => ({
      baseImageUrl: '',
      cardWidth: 461,
      cardHeight: 709,
      artUrl: '',
      title: '',
      bannerImageUrl: 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/0e4d67779c_07b28f54f_GreenBanner.png',
      costIcons: []
    })
  }
};

export function getTemplate(key) {
  return CARD_TEMPLATES[key];
}

export function getTemplateList() {
  return Object.values(CARD_TEMPLATES);
}