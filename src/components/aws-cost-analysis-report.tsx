import { MessageResponse } from '@/components/ai-elements/message';

interface AwsCostAnalysisReportProps {
  children: string;
}

export function AwsCostAnalysisReport({
  children,
}: AwsCostAnalysisReportProps) {
  return (
    <div className="w-full overflow-x-auto rounded-lg border bg-background p-4 shadow-sm">
      <MessageResponse
        className="min-w-0 text-sm leading-6 [&_a]:font-medium [&_a]:text-primary [&_a]:underline-offset-4 hover:[&_a]:underline [&_blockquote]:my-4 [&_blockquote]:border-l-2 [&_blockquote]:border-primary [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs [&_h1]:mb-4 [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h2]:mb-3 [&_h2]:mt-7 [&_h2]:border-b [&_h2]:pb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:mt-5 [&_h3]:font-semibold [&_li]:my-1 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-3 [&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_table]:my-4 [&_table]:min-w-[36rem] [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:p-3 [&_td]:align-top [&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:p-3 [&_th]:text-left [&_th]:font-semibold [&_thead]:sticky [&_thead]:top-0 [&_tr:nth-child(even)]:bg-muted/40 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6"
      >
        {children}
      </MessageResponse>
    </div>
  );
}
