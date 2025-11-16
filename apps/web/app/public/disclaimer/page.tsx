export const dynamic = "force-dynamic";

export default function DisclaimerPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-bold mb-4">免責事項</h1>
      <p className="mb-3">
        当サイトの情報は正確性・最新性の確保に努めていますが、内容を保証するものではありません。リンク先の外部サイトで提供されるサービス・商品に関するトラブルについて、当サイトは一切の責任を負いません。
      </p>
      <p className="mb-3">
        価格・在庫・キャンペーン等は予告なく変更される場合があります。必ず各公式サイトの最新情報をご確認ください。
      </p>
      <p>本ページは広告を含む場合があります。</p>
    </main>
  );
}
