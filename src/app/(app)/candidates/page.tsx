"use client";

import { useState } from "react";
import {
  Card, CardContent, Badge, Avatar, AvatarFallback,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@onehash/ui";
import { useIsMobile } from "@/hooks/use-mobile";
import { MainPagesLayout } from "@/components/MainPagesLayout";
import { useTranslation } from "react-i18next";

const candidates = [
  { name: "Alex Rivera", role: "Sr. Frontend Engineer", stage: "Interview", tags: ["React", "TypeScript"], score: 92, added: "2d ago" },
  { name: "Maria Kim", role: "Product Designer", stage: "Offer", tags: ["Figma", "UI/UX"], score: 88, added: "5d ago" },
  { name: "Sam Chen", role: "Data Scientist", stage: "Screening", tags: ["Python", "ML"], score: 76, added: "1d ago" },
  { name: "Jordan Lee", role: "Engineering Manager", stage: "Interview", tags: ["Leadership", "Agile"], score: 85, added: "3d ago" },
  { name: "Taylor Swift", role: "Marketing Lead", stage: "Applied", tags: ["Growth", "SEO"], score: 70, added: "4h ago" },
];

const initials = (name: string) => name.split(" ").map(n => n[0]).join("");

export default function CandidatesPage() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");

  const filtered = candidates.filter((c) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.role.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <MainPagesLayout
      searchValue={search}
      onSearchChange={setSearch}
      actionLabel={t("create")}
      actionIcon="UserPlus"
      onAction={() => {}}
    >
      {isMobile ? (
        <div className="space-y-2">
          {filtered.map((c) => (
            <Card key={c.name} className="active:bg-muted/50 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center gap-2.5 mb-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs bg-muted">{initials(c.name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium truncate">{c.name}</span>
                      <span className="text-xs font-medium">{c.score}%</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{c.role}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge variant="secondary" className="text-[10px]">{c.stage}</Badge>
                  {c.tags.map(tag => <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>)}
                </div>
              </CardContent>
            </Card>
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">{t("no_results")}</p>
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">{t("name")}</TableHead>
                  <TableHead className="text-xs">{t("applied_for")}</TableHead>
                  <TableHead className="text-xs">{t("stage")}</TableHead>
                  <TableHead className="text-xs">{t("tags")}</TableHead>
                  <TableHead className="text-xs text-right">{t("score")}</TableHead>
                  <TableHead className="text-xs text-right">{t("added")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow key={c.name} className="cursor-pointer hover:bg-muted/50">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-[10px] bg-muted">{initials(c.name)}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">{c.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.role}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-[10px]">{c.stage}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {c.tags.map(tag => <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>)}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-right font-medium">{c.score}%</TableCell>
                    <TableCell className="text-xs text-muted-foreground text-right">{c.added}</TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-sm text-muted-foreground text-center py-8">{t("no_results")}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </MainPagesLayout>
  );
}
