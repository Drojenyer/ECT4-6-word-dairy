const fs = require('fs').promises;
const path = require('path');

async function copyDataFiles() {
  const dataDir = path.join(__dirname, 'data');
  await fs.mkdir(dataDir, { recursive: true });

  const sourceDir = 'E:\\Vocabu_work';
  const files = [
    { source: path.join(sourceDir, '3-CET4-顺序.json'), dest: path.join(dataDir, '3-CET4-顺序.json') },
    { source: path.join(sourceDir, '4-CET6-顺序.json'), dest: path.join(dataDir, '4-CET6-顺序.json') }
  ];

  for (const { source, dest } of files) {
    try {
      const data = await fs.readFile(source);
      await fs.writeFile(dest, data);
      console.log(`已复制: ${path.basename(dest)}`);
    } catch (error) {
      console.error(`复制失败 ${path.basename(dest)}:`, error.message);
    }
  }
}

copyDataFiles().then(() => {
  console.log('数据文件复制完成');
  process.exit(0);
}).catch(error => {
  console.error('复制过程出错:', error);
  process.exit(1);
});