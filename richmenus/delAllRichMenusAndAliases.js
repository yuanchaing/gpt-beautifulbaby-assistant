// ESM 版：刪除預設 Rich Menu、全部 alias、全部 Rich Menu
import * as line from '@line/bot-sdk';
import 'dotenv/config';

const client = new line.Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
});

async function run() {
  console.log('=== Delete ALL Rich Menus & Aliases ===');
  try {
    await client.deleteDefaultRichMenu().catch(() => {});
    console.log('Default rich menu cleared (if any).');
  } catch (e) {
    console.log('Skip clear default:', e?.message || e);
  }

  try {
    const aliasList = await client.getRichMenuAliasList();
    for (const a of aliasList.aliases || []) {
      await client.deleteRichMenuAlias(a.richMenuAliasId).catch(() => {});
      console.log('Alias deleted:', a.richMenuAliasId);
    }
  } catch (e) {
    console.log('List alias failed (continue):', e?.message || e);
  }

  try {
    const menus = await client.getRichMenuList();
    for (const m of menus || []) {
      await client.deleteRichMenu(m.richMenuId).catch(() => {});
      console.log('RichMenu deleted:', m.richMenuId);
    }
  } catch (e) {
    console.log('List menus failed (continue):', e?.message || e);
  }

  console.log('All done.');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
