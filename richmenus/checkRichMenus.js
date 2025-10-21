// ESM 版：列出所有 Rich Menus 與 Aliases
import * as line from '@line/bot-sdk';
import 'dotenv/config';

const client = new line.Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
});

async function run() {
  console.log('=== Rich Menus ===');
  const menus = await client.getRichMenuList().catch(() => ({ richmenus: [] }));
  for (const m of menus || []) {
    console.log(`- ${m.richMenuId} | name="${m.name}" | selected=${m.selected}`);
  }

  console.log('\n=== Aliases ===');
  const aliases = await client.getRichMenuAliasList().catch(() => ({ aliases: [] }));
  for (const a of aliases.aliases || []) {
    console.log(`- ${a.richMenuAliasId} -> ${a.richMenuId}`);
  }
}

run().catch((e) => {
  console.error(e?.originalError?.response?.data || e);
  process.exit(1);
});
