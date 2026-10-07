const { parseLotteryText } = require('./js/parser.js');

const testCases = `
งวด 16/10/69
ลูกค้า: คุณสมศรี
123 = 100x50
456 บน 50 โต๊ด 20
กลับ 789 20x20
12 34 56 บล 50*50
กลับ 89 = 30x30
19 ประตู 5 บล 20x20
รูดหน้า 7 = 10x10
วิ่งบน 5 = 1000
วิ่งล่าง 9 = 500
88 99 บน 100
`;

const res = parseLotteryText(testCases);
console.log('Parsed items count:', res.items.length);
console.log('Unparsed count:', res.unparsedLines.length);
console.log('Unparsed details:', res.unparsedLines);
console.log('Sample parsed items:', res.items.slice(0, 10));

// Count by type
const summary = {};
res.items.forEach(it => {
  summary[it.type] = (summary[it.type] || 0) + it.amount;
});
console.log('Summary by type:', summary);
