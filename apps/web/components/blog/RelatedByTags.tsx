import { fetchRelatedBlogsByTags } from "@/lib/queries";
import RelatedByTags from "@/components/common/RelatedByTags";

export default async function BlogRelatedByTags(props: {
  siteId: string;
  tags: string[];
  currentSlug: string;
  title?: string;
  limit?: number;
}) {
  const items = await fetchRelatedBlogsByTags(
    props.siteId,
    props.tags,
    props.currentSlug,
    props.limit ?? 3
  );

  // 型は構造互換なのでそのまま渡せる
  return <RelatedByTags title={props.title ?? "関連ガイド"} items={items} />;
}
