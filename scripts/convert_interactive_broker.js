const fs = require('fs');
const lines = fs.readFileSync('./interactive_broker.csv', 'utf8').trim().split('\n');

// IB symbol -> Yahoo Finance symbol (when they differ)
const TICKER_MAP = {
  AIR: 'AIR.PA', // Airbus SE on Euronext Paris
};

// Override categories (default: stock)
const CATEGORIES = {
  ECH: 'etf',   // iShares MSCI Chile ETF
};

const rows = [['date','symbol','name','category','native_currency','quantity','price','currency','type','account_institution','account_type']];

for (const line of lines) {
  const cols = line.split(',');
  if (cols[0] !== 'Transaction History' || cols[1] !== 'Data') continue;

  // cols: [0]="Transaction History", [1]="Data", [2]=date, [3]=account, [4]=description,
  //       [5]=transaction_type, [6]=symbol, [7]=quantity, [8]=price, [9]=price_currency,
  //       [10]=gross_amount, [11]=commission, [12]=net_amount
  const txType = cols[5].trim();
  if (txType !== 'Buy' && txType !== 'Sell') continue;

  const ibSymbol = cols[6].trim();
  if (!ibSymbol || ibSymbol === '-') continue;

  const date = cols[2].trim();
  const description = cols[4].trim();
  const quantity = Math.abs(parseFloat(cols[7]));
  const price = parseFloat(cols[8]);
  const priceCurrency = cols[9].trim();
  const type = txType.toLowerCase();

  const symbol = TICKER_MAP[ibSymbol] || ibSymbol;
  const category = CATEGORIES[ibSymbol] || 'stock';
  const nativeCurrency = priceCurrency;

  rows.push([date, symbol, description, category, nativeCurrency, quantity, price, priceCurrency, type, 'Interactive Brokers', 'Taxable']);
}

const csv = rows.map(r => r.join(',')).join('\n');
fs.writeFileSync('./csv/interactive_broker_import.csv', csv);
console.log('Generated', rows.length - 1, 'rows');
console.log('\nPreview:');
console.log(rows.map(r => r.join(',')).join('\n'));
