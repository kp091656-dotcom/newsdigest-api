const { data, error } = await supabase
  .from('alpha_reports') // 請替換成你實際的表名
  .upsert(reportPayload);

if (error) {
  // 💡 加上這行，把詳細錯誤抓出來
  console.error('❌ Supabase 詳細錯誤訊息:', JSON.stringify(error, null, 2));
  throw new Error(`Supabase upsert 失敗 HTTP 400: ${error.message}`);
}