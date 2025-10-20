// ESM 版：列出 Rich Menu 與 Alias
import 'dotenv/config';
import * as line from '@line/bot-sdk';

const client = new line.Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
});

async function main() {
  try {
    const menus = await client.getRichMenuList();
    console.log('=== Rich Menus ===');
    if (!menus?.length) console.log('(none)');
    for (const m of menus || []) {
      console.log(`- ${m.richMenuId} | name="${m.name}" | selected=${m.selected}`);
    }
  } catch (e) {
    console.error('❌ 取得 RichMenu 失敗：', e.originalError?.response?.data || e.message);
  }

  try {
    const aliasList = await client.getRichMenuAliasList();
    console.log('\n=== Aliases ===');
    if (!aliasList.aliases?.length) console.log('(none)');
    for (const a of aliasList.aliases || []) {
      console.log(`- ${a.richMenuAliasId} -> ${a.richMenuId}`);
    }
  } catch (e) {
    console.error('❌ 取得 Alias 失敗：', e.originalError?.response?.data || e.message);
  }
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
