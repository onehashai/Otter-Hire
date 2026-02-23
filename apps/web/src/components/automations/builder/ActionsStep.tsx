"use client";

import { Card, CardContent } from "@onehash/ui/card";
import { Button } from "@onehash/ui/button";
import { InputField } from "@onehash/ui/input";
import { Label } from "@onehash/ui/label";
import { Textarea } from "@onehash/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@onehash/ui/select";
import { X, Zap, Eye } from "lucide-react";
import { FieldRow } from "./FieldRow";
import {
  actionTypes,
  stages,
  emailTemplates,
  type Action,
} from "./types";

export interface ActionsStepProps {
  actions: Action[];
  onAddAction: (type: string) => void;
  onUpdateActionConfig: (id: string, key: string, value: string) => void;
  onRemoveAction: (id: string) => void;
  onEmailPreviewOpen: () => void;
}

export function ActionsStep({
  actions,
  onAddAction,
  onUpdateActionConfig,
  onRemoveAction,
  onEmailPreviewOpen,
}: ActionsStepProps) {
  return (
    <div className="p-4 space-y-4">
      <p className="text-xs text-muted-foreground">
        Define what happens when this automation fires.
      </p>

      {actions.map((a, idx) => {
        const def = actionTypes.find((at) => at.id === a.type);
        const Icon = def?.icon ?? Zap;
        return (
          <Card key={a.id}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded bg-muted flex items-center justify-center">
                    <Icon className="h-3 w-3 text-muted-foreground" />
                  </div>
                  <span className="text-xs font-medium">
                    Action {idx + 1}: {a.label}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => onRemoveAction(a.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>

              {a.type === "send_email" && (
                <div className="space-y-3">
                  <FieldRow label="Email Template">
                    <div className="flex gap-2">
                      <Select
                        value={a.config.template ?? ""}
                        onValueChange={(v) =>
                          onUpdateActionConfig(a.id, "template", v)
                        }
                      >
                        <SelectTrigger className="h-8 text-xs flex-1">
                          <SelectValue placeholder="Select template" />
                        </SelectTrigger>
                        <SelectContent>
                          {emailTemplates.map((tmpl) => (
                            <SelectItem
                              key={tmpl.id}
                              value={tmpl.id}
                              className="text-xs"
                            >
                              {tmpl.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1"
                        onClick={onEmailPreviewOpen}
                      >
                        <Eye className="h-3 w-3" /> Preview
                      </Button>
                    </div>
                  </FieldRow>
                </div>
              )}
              {a.type === "move_stage" && (
                <FieldRow label="Move to">
                  <Select
                    value={a.config.stage ?? ""}
                    onValueChange={(v) =>
                      onUpdateActionConfig(a.id, "stage", v)
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select stage" />
                    </SelectTrigger>
                    <SelectContent>
                      {stages.map((s) => (
                        <SelectItem key={s} value={s} className="text-xs">
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FieldRow>
              )}
              {a.type === "assign_recruiter" && (
                <FieldRow label="Assign to">
                  <Select
                    value={a.config.recruiter ?? ""}
                    onValueChange={(v) =>
                      onUpdateActionConfig(a.id, "recruiter", v)
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select recruiter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="jane" className="text-xs">
                        Jane Doe
                      </SelectItem>
                      <SelectItem value="john" className="text-xs">
                        John Smith
                      </SelectItem>
                      <SelectItem value="sarah" className="text-xs">
                        Sarah Lee
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </FieldRow>
              )}
              {a.type === "add_tag" && (
                <FieldRow label="Tag name">
                  <InputField
                    value={a.config.tag ?? ""}
                    onChange={(e) =>
                      onUpdateActionConfig(a.id, "tag", e.target.value)
                    }
                    className="h-8 text-xs"
                    placeholder="e.g. Senior"
                  />
                </FieldRow>
              )}
              {a.type === "add_note" && (
                <FieldRow label="Note content">
                  <Textarea
                    value={a.config.note ?? ""}
                    onChange={(e) =>
                      onUpdateActionConfig(a.id, "note", e.target.value)
                    }
                    className="text-xs min-h-[50px] resize-none"
                    placeholder="Note text..."
                  />
                </FieldRow>
              )}
              {a.type === "send_notification" && (
                <FieldRow label="Message">
                  <InputField
                    value={a.config.message ?? ""}
                    onChange={(e) =>
                      onUpdateActionConfig(a.id, "message", e.target.value)
                    }
                    className="h-8 text-xs"
                    placeholder="Notification message"
                  />
                </FieldRow>
              )}
            </CardContent>
          </Card>
        );
      })}

      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground">
          Add an action
        </Label>
        {["Communication", "Candidate", "Interview"].map((cat) => {
          const items = actionTypes.filter((at) => at.category === cat);
          return (
            <div key={cat} className="space-y-1">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {cat}
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {items.map((at) => {
                  const ActionIcon = at.icon;
                  return (
                    <Button
                      key={at.id}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 text-xs justify-start gap-1.5"
                      onClick={() => onAddAction(at.id)}
                    >
                      <ActionIcon className="h-3 w-3" /> {at.label}
                    </Button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
