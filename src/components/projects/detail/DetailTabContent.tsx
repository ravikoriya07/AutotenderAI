import { DetailFieldList } from "@/components/projects/detail/DetailFieldList";
import { DetailPlaceholder } from "@/components/projects/detail/DetailPlaceholder";
import { DetailRecordList } from "@/components/projects/detail/DetailRecordList";
import { DetailStringList } from "@/components/projects/detail/DetailStringList";
import type { ProjectDetailTabContent } from "@/types/project-detail";

type DetailTabContentProps = {
  content: ProjectDetailTabContent;
};

export function DetailTabContent({ content }: DetailTabContentProps) {
  switch (content.type) {
    case "fields":
      return (
        <DetailFieldList
          title={content.title}
          fields={content.fields}
          sections={content.sections}
        />
      );
    case "string_list":
      return (
        <DetailStringList title={content.title} items={content.items} />
      );
    case "record_list":
      return (
        <DetailRecordList title={content.title} records={content.records} />
      );
    case "placeholder":
      return <DetailPlaceholder message={content.message} />;
    default: {
      const _exhaustive: never = content;
      return _exhaustive;
    }
  }
}
