// firebase/functions/src/utils/seasonalContext.ts
export type SeasonalContext = {
  /** 記事タイトルなどに入れやすい短いキーワード（例: "新生活"） */
  keyword: string;
  /** 「◯◯シーズン」のようなラベル（例: "新生活シーズン"） */
  label: string;
  /** モデルに渡す説明文。季節・行事と読者の状況を簡単に書く。 */
  description: string;
};

/**
 * 日本時間ベースで「今の季節・行事」の文脈をざっくり返す。
 * ※細かくやりたくなったらここを編集すれば OK。
 */
export function getSeasonalContext(dateInput?: Date): SeasonalContext {
  // Cloud Functions は UTC なので、ざっくり JST(+9h) に寄せる
  const base =
    dateInput ??
    new Date(Date.now() + 9 * 60 * 60 * 1000); /* 9時間ずらすだけの簡易対応 */
  const month = base.getMonth() + 1;
  const day = base.getDate();

  // 3月中旬〜4月上旬: 新生活・引っ越し
  if ((month === 3 && day >= 10) || (month === 4 && day <= 10)) {
    return {
      keyword: "新生活",
      label: "新生活シーズン",
      description:
        "進学や就職、転勤などで新生活を始める人が多い時期です。引っ越し準備や家具・家電の一時利用、初期費用を抑えたいニーズが高まっています。",
    };
  }

  // 4月中旬〜5月上旬: GW・大型連休
  if ((month === 4 && day > 10) || (month === 5 && day <= 10)) {
    return {
      keyword: "GW",
      label: "ゴールデンウィーク前後",
      description:
        "ゴールデンウィークや週末の小旅行、実家への帰省などで一時的に家電や荷物が増えやすい時期です。短期レンタルやサブ冷蔵庫・カメラの需要が高まりやすくなります。",
    };
  }

  // 6月: 梅雨
  if (month === 6) {
    return {
      keyword: "梅雨",
      label: "梅雨どき",
      description:
        "雨の日が多く、外出が減ったり洗濯物が乾きにくくなる時期です。室内時間が増えることで、家電レンタルや在宅環境を整えたいニーズが高まりやすくなります。",
    };
  }

  // 7〜8月: 夏休み・お盆・帰省・キャンプ
  if (month === 7 || month === 8) {
    return {
      keyword: "夏休み",
      label: "夏休み・お盆シーズン",
      description:
        "夏休みやお盆の帰省、キャンプやアウトドアなどで一時的に家電を使いたいシーンが増える時期です。カメラ・冷蔵庫・ポータブル電源などのレンタルニーズが高まります。",
    };
  }

  // 9月: 台風・防災・残暑
  if (month === 9) {
    return {
      keyword: "防災",
      label: "台風・防災シーズン",
      description:
        "台風シーズンで停電や防災への備えを見直す人が増える時期です。非常用の家電や、万が一に備えた一時的なレンタル需要が高まりやすくなります。",
    };
  }

  // 10月: 秋・衣替え
  if (month === 10) {
    return {
      keyword: "衣替え",
      label: "秋の衣替えシーズン",
      description:
        "夏物から冬物へと持ち物や部屋の構成を切り替える時期です。暖房器具や冬向け家電を買うか迷う人が増え、『まずはレンタルで試したい』というニーズが出てきます。",
    };
  }

  // 11〜12月: 年末・年始・大掃除
  if (month === 11 || month === 12) {
    return {
      keyword: "年末",
      label: "年末年始の準備シーズン",
      description:
        "年末の大掃除やおせち・来客の準備などで、一時的に家電や収納が必要になりやすい時期です。サブ冷蔵庫や調理家電などをレンタルで補う需要が増えます。",
    };
  }

  // 1〜2月: 冬・在宅・受験
  if (month === 1 || month === 2) {
    return {
      keyword: "冬の暮らし",
      label: "冬の在宅シーズン",
      description:
        "寒さが厳しく在宅時間が長くなりやすい時期です。暖房・加湿・在宅ワーク用の家電など、期間限定で使いたいニーズが高まりやすくなります。",
    };
  }

  // デフォルト（5月中旬〜5月末など）
  return {
    keyword: "暮らしの見直し",
    label: "暮らしの見直しシーズン",
    description:
      "生活リズムや持ち物を整え直したい人が多い時期です。『買う前に試したい』『今だけ家電を増やしたい』といったニーズに、レンタルやサブスクがフィットしやすくなります。",
  };
}
