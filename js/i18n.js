/* ============================================
   PORTFOLIO INTELLIGENCE — Internationalization
   ============================================ */

const I18N = {
  da: {
    // Auth
    'auth.subtitle': 'Overlap-analyse, scoring og rebalancering for danske investorer',
    'auth.login': 'Log ind',
    'auth.signup': 'Opret konto',
    'auth.email': 'E-mail',
    'auth.password': 'Adgangskode',
    'auth.confirmPassword': 'Bekræft adgangskode',
    'auth.loginBtn': 'Log ind',
    'auth.signupBtn': 'Opret konto',
    'auth.demoMode': 'Fortsæt uden konto (demo)',

    // Nav
    'nav.overview': 'Overblik',
    'nav.networth': 'Formue',
    'nav.portfolio': 'Portefølje',
    'nav.overlap': 'Overlap',
    'nav.score': 'Score',
    'nav.rebalance': 'Rebalancering',
    'nav.settings': 'Indstillinger',
    'nav.logout': 'Log ud',
    'nav.more': 'Mere',

    // Overview
    'overview.title': 'Overblik',
    'overview.subtitle': 'Dit samlede finansielle billede',
    'overview.scanDoc': 'Scan dokument',
    'overview.netWorth': 'Samlet formue',
    'overview.totalAssets': 'Aktiver',
    'overview.totalLiabilities': 'Passiver',
    'overview.portfolioScore': 'Portefølje-score',
    'overview.allocationChart': 'Aktivfordeling',
    'overview.projectionChart': 'Formuefremskrivning',
    'overview.alerts': 'Advarsler',

    // Net Worth
    'networth.title': 'Formue',
    'networth.subtitle': 'Aktiver, passiver og nettoformue',
    'networth.addEntry': 'Tilføj post',
    'networth.assets': 'Aktiver',
    'networth.liabilities': 'Passiver',
    'networth.netWorth': 'Nettoformue',
    'networth.noAssets': 'Ingen aktiver endnu — tilføj din første post',
    'networth.noLiabilities': 'Ingen passiver endnu',
    'networth.breakdownChart': 'Fordeling',

    // Portfolio
    'portfolio.title': 'Portefølje',
    'portfolio.subtitle': 'Dine aktier, ETF\'er og fonde',
    'portfolio.import': 'Importér',
    'portfolio.addPosition': 'Tilføj position',
    'portfolio.totalValue': 'Samlet værdi',
    'portfolio.positions': 'Positioner',
    'portfolio.topSector': 'Største sektor',
    'portfolio.holdings': 'Beholdninger',
    'portfolio.noHoldings': 'Ingen positioner — tilføj aktier, ETF\'er eller fonde',
    'portfolio.thTicker': 'Ticker',
    'portfolio.thName': 'Navn',
    'portfolio.thType': 'Type',
    'portfolio.thShares': 'Antal',
    'portfolio.thPrice': 'Kurs',
    'portfolio.thValue': 'Værdi',
    'portfolio.thWeight': 'Vægt',

    // Overlap
    'overlap.title': 'Overlap-analyse',
    'overlap.subtitle': 'Se hvor dine investeringer overlapper',
    'overlap.runAnalysis': 'Kør analyse',
    'overlap.matrix': 'Overlap-matrix',
    'overlap.sectorExposure': 'Sektoreksponering',
    'overlap.geoExposure': 'Geografisk eksponering',
    'overlap.emptyTitle': 'Ingen overlap-data endnu',
    'overlap.emptyDesc': 'Tilføj mindst 2 positioner i din portefølje, og kør derefter analysen.',

    // Score
    'score.title': 'Portefølje-score',
    'score.subtitle': 'Vurdering baseret på investorfilosofi',
    'score.choosePhilosophy': 'Vælg filosofi',
    'score.bogleDesc': 'Lav omkostning, bred diversificering',
    'score.buffettDesc': 'Kvalitet, dyb voldgrav, langsigtet',
    'score.dalioDesc': 'All-weather, risiko-paritet',
    'score.lynchDesc': 'Vækst til rimelig pris (GARP)',
    'score.emptyTitle': 'Ingen score endnu',
    'score.emptyDesc': 'Tilføj positioner i din portefølje for at få en score.',

    // Rebalance
    'rebalance.title': 'Rebalancering',
    'rebalance.subtitle': 'Handlingsforslag til din portefølje',
    'rebalance.emptyTitle': 'Ingen forslag endnu',
    'rebalance.emptyDesc': 'Kør en portefølje-score for at generere rebalanceringsforslag.',

    // Settings
    'settings.title': 'Indstillinger',
    'settings.subtitle': 'Tilpas din oplevelse',
    'settings.language': 'Sprog',
    'settings.theme': 'Tema',
    'settings.dark': 'Mørkt',
    'settings.light': 'Lyst',
    'settings.auto': 'Auto',
    'settings.currency': 'Valuta',
    'settings.projection': 'Fremskrivning',
    'settings.annualReturn': 'Forventet årligt afkast (%)',
    'settings.years': 'Antal år',
    'settings.dataManagement': 'Datahåndtering',
    'settings.exportData': 'Eksportér data (JSON)',
    'settings.importData': 'Importér data',
    'settings.about': 'Om',

    // Modals
    'modal.addEntry': 'Tilføj post',
    'modal.editEntry': 'Redigér post',
    'modal.entryName': 'Navn',
    'modal.entryAmount': 'Beløb (kr.)',
    'modal.entryType': 'Type',
    'modal.asset': 'Aktiv',
    'modal.liability': 'Passiv',
    'modal.entryCategory': 'Kategori',
    'modal.cancel': 'Annullér',
    'modal.save': 'Gem',
    'modal.addPosition': 'Tilføj position',
    'modal.editPosition': 'Redigér position',
    'modal.ticker': 'Ticker / ISIN',
    'modal.positionName': 'Navn',
    'modal.positionType': 'Type',
    'modal.shares': 'Antal',
    'modal.avgPrice': 'Gns. købspris (kr.)',
    'modal.currentPrice': 'Aktuel kurs (kr.)',
    'modal.scanTitle': 'Scan dokument',
    'modal.scanDrop': 'Træk fil hertil eller klik for at vælge',
    'modal.scanFormats': 'PDF, PNG, JPG — maks. 10 MB',
    'modal.scanning': 'Analyserer dokument med AI…',
    'modal.applyResults': 'Anvend resultater',
  },

  en: {
    // Auth
    'auth.subtitle': 'Overlap analysis, scoring & rebalancing for Danish investors',
    'auth.login': 'Log in',
    'auth.signup': 'Sign up',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.confirmPassword': 'Confirm password',
    'auth.loginBtn': 'Log in',
    'auth.signupBtn': 'Sign up',
    'auth.demoMode': 'Continue without account (demo)',

    // Nav
    'nav.overview': 'Overview',
    'nav.networth': 'Net Worth',
    'nav.portfolio': 'Portfolio',
    'nav.overlap': 'Overlap',
    'nav.score': 'Score',
    'nav.rebalance': 'Rebalance',
    'nav.settings': 'Settings',
    'nav.logout': 'Log out',
    'nav.more': 'More',

    // Overview
    'overview.title': 'Overview',
    'overview.subtitle': 'Your complete financial picture',
    'overview.scanDoc': 'Scan document',
    'overview.netWorth': 'Net worth',
    'overview.totalAssets': 'Assets',
    'overview.totalLiabilities': 'Liabilities',
    'overview.portfolioScore': 'Portfolio score',
    'overview.allocationChart': 'Asset allocation',
    'overview.projectionChart': 'Net worth projection',
    'overview.alerts': 'Alerts',

    // Net Worth
    'networth.title': 'Net Worth',
    'networth.subtitle': 'Assets, liabilities and net worth',
    'networth.addEntry': 'Add entry',
    'networth.assets': 'Assets',
    'networth.liabilities': 'Liabilities',
    'networth.netWorth': 'Net worth',
    'networth.noAssets': 'No assets yet — add your first entry',
    'networth.noLiabilities': 'No liabilities yet',
    'networth.breakdownChart': 'Breakdown',

    // Portfolio
    'portfolio.title': 'Portfolio',
    'portfolio.subtitle': 'Your stocks, ETFs and funds',
    'portfolio.import': 'Import',
    'portfolio.addPosition': 'Add position',
    'portfolio.totalValue': 'Total value',
    'portfolio.positions': 'Positions',
    'portfolio.topSector': 'Top sector',
    'portfolio.holdings': 'Holdings',
    'portfolio.noHoldings': 'No positions — add stocks, ETFs or funds',
    'portfolio.thTicker': 'Ticker',
    'portfolio.thName': 'Name',
    'portfolio.thType': 'Type',
    'portfolio.thShares': 'Shares',
    'portfolio.thPrice': 'Price',
    'portfolio.thValue': 'Value',
    'portfolio.thWeight': 'Weight',

    // Overlap
    'overlap.title': 'Overlap Analysis',
    'overlap.subtitle': 'See where your investments overlap',
    'overlap.runAnalysis': 'Run analysis',
    'overlap.matrix': 'Overlap matrix',
    'overlap.sectorExposure': 'Sector exposure',
    'overlap.geoExposure': 'Geographic exposure',
    'overlap.emptyTitle': 'No overlap data yet',
    'overlap.emptyDesc': 'Add at least 2 positions in your portfolio, then run the analysis.',

    // Score
    'score.title': 'Portfolio Score',
    'score.subtitle': 'Assessment based on investor philosophy',
    'score.choosePhilosophy': 'Choose philosophy',
    'score.bogleDesc': 'Low cost, broad diversification',
    'score.buffettDesc': 'Quality, deep moat, long-term',
    'score.dalioDesc': 'All-weather, risk parity',
    'score.lynchDesc': 'Growth at a reasonable price (GARP)',
    'score.emptyTitle': 'No score yet',
    'score.emptyDesc': 'Add positions to your portfolio to get a score.',

    // Rebalance
    'rebalance.title': 'Rebalancing',
    'rebalance.subtitle': 'Action suggestions for your portfolio',
    'rebalance.emptyTitle': 'No suggestions yet',
    'rebalance.emptyDesc': 'Run a portfolio score to generate rebalancing suggestions.',

    // Settings
    'settings.title': 'Settings',
    'settings.subtitle': 'Customize your experience',
    'settings.language': 'Language',
    'settings.theme': 'Theme',
    'settings.dark': 'Dark',
    'settings.light': 'Light',
    'settings.auto': 'Auto',
    'settings.currency': 'Currency',
    'settings.projection': 'Projection',
    'settings.annualReturn': 'Expected annual return (%)',
    'settings.years': 'Number of years',
    'settings.dataManagement': 'Data management',
    'settings.exportData': 'Export data (JSON)',
    'settings.importData': 'Import data',
    'settings.about': 'About',

    // Modals
    'modal.addEntry': 'Add entry',
    'modal.editEntry': 'Edit entry',
    'modal.entryName': 'Name',
    'modal.entryAmount': 'Amount (DKK)',
    'modal.entryType': 'Type',
    'modal.asset': 'Asset',
    'modal.liability': 'Liability',
    'modal.entryCategory': 'Category',
    'modal.cancel': 'Cancel',
    'modal.save': 'Save',
    'modal.addPosition': 'Add position',
    'modal.editPosition': 'Edit position',
    'modal.ticker': 'Ticker / ISIN',
    'modal.positionName': 'Name',
    'modal.positionType': 'Type',
    'modal.shares': 'Shares',
    'modal.avgPrice': 'Avg. buy price (DKK)',
    'modal.currentPrice': 'Current price (DKK)',
    'modal.scanTitle': 'Scan document',
    'modal.scanDrop': 'Drag file here or click to select',
    'modal.scanFormats': 'PDF, PNG, JPG — max 10 MB',
    'modal.scanning': 'Analyzing document with AI…',
    'modal.applyResults': 'Apply results',
  }
};

/**
 * Apply translations to all elements with data-i18n attribute
 */
function applyTranslations(lang) {
  const strings = I18N[lang] || I18N.da;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (strings[key]) {
      if (el.tagName === 'INPUT' && el.type !== 'submit') {
        el.placeholder = strings[key];
      } else {
        el.textContent = strings[key];
      }
    }
  });
  document.documentElement.lang = lang;
}

/**
 * Get a single translation string
 */
function t(key, lang) {
  const l = lang || (window.APP_STATE && window.APP_STATE.lang) || 'da';
  return (I18N[l] && I18N[l][key]) || (I18N.da && I18N.da[key]) || key;
}
