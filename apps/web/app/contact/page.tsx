export const metadata = { title: "お問い合わせ | Kariraku" };

export default function Page() {
  return (
    <main className="container-kariraku py-10 space-y-6">
      <h1 className="text-2xl font-bold">お問い合わせ</h1>
      <p className="text-sm opacity-80">
        ご意見・ご質問は{" "}
        <a className="underline" href="mailto:info@kariraku.com">
          info@kariraku.com
        </a>{" "}
        へご連絡ください。
      </p>
    </main>
  );
}
