// ESM 版：刪除所有 Rich Menu 與所有 Alias
import 'dotenv/config';
import * as line from '@line/bot-sdk';

const client = new line.Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
});

async function main() {
  try {
    await client.deleteDefaultRichMenu();
    console.log('✅ 已清除預設 Rich Menu');
  } catch (e) {
    console.log('ℹ️ 無預設或已清除：', e.originalError?.response?.data || e.message || '');
  }

  try {
    const aliasList = await client.getRichMenuAliasList();
    if (Array.isArray(aliasList?.aliases) && aliasList.aliases.length) {
      for (const a of aliasList.aliases) {
        try {
          await client.deleteRichMenuAlias(a.richMenuAliasId);
          console.log(`🗑️ 刪除 alias: ${a.richMenuAliasId}`);
        } catch (e) {
          console.error('❌ 刪 alias 失敗：', a.richMenuAliasId, e.originalError?.response?.data || e.message);
        }
      }
    } else {
      console.log('ℹ️ 無 alias 可刪');
    }
  } catch (e) {
    console.error('❌ 取得 alias 列表失敗：', e.originalError?.response?.data || e.message);
  }

  try {
    const menus = await client.getRichMenuList();
    if (Array.isArray(menus) && menus.length) {
      for (const m of menus) {
        try {
          await client.deleteRichMenu(m.richMenuId);
          console.log(`🗑️ 刪除 richmenu: ${m.richMenuId} (${m.name})`);
        } catch (e) {
          console.error('❌ 刪 richmenu 失敗：', m.richMenuId, e.originalError?.response?.data || e.message);
        }
      }
    } else {
      console.log('ℹ️ 無 richmenu 可刪');
    }
  } catch (e) {
    console.error('❌ 取得 richmenu 列表失敗：', e.originalError?.response?.data || e.message);
  }

  console.log('🎯 全部刪除流程完成');
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
