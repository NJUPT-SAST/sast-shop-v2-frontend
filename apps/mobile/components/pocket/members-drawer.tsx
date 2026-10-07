"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMobileRouter as useRouter } from "@/components/mobile-navigation-feedback";
import { RiSearchLine } from "@remixicon/react";
import {
  getPocket,
  getPocketRecognition,
  searchPocketParticipants,
  replacePocketMembers,
  previewPocketSplit,
  publishPocket,
  resolvePocketFace,
  type PocketDetail,
  type PocketFaceMatch,
  type PocketMemberSelection,
  type PocketPhoto,
  type PocketSplit,
  type PocketUser,
} from "@sast-shop/api";
import { Button } from "@workspace/ui/components/button";
import { Checkbox } from "@workspace/ui/components/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@workspace/ui/components/input-group";
import { Empty } from "@workspace/ui/components/empty";
import { Spinner } from "@workspace/ui/components/spinner";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@workspace/ui/components/drawer";
import { pocketError, pocketMoney } from "@/lib/pocket";
import { reconcilePocketSelections } from "@/lib/pocket-selection";
import { ManagedImage } from "../managed-image";
import {
  PocketConsent,
  PocketError,
  PocketPerson,
  usePocketAction,
  usePocketOptions,
  usePocketResource,
} from "./shared";

export function PocketMembersDrawer({
  detail,
  onClose,
  onChanged,
}: {
  detail: PocketDetail;
  onClose: () => void;
  onChanged: () => void;
}) {
  const options = usePocketOptions();
  const router = useRouter();
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [current, setCurrent] = useState(detail.pocket);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{
    query: string;
    users: PocketUser[];
    nextPageToken: string;
  } | null>(null);
  const [searchError, setSearchError] = useState("");
  const [resolving, setResolving] = useState<PocketFaceMatch | null>(null);
  const [selected, setSelected] = useState<Map<string, PocketMemberSelection>>(
    () =>
      new Map(
        detail.members.map((m) => [
          m.userId,
          {
            userId: m.userId,
            selectionSource: m.isOwner
              ? "owner"
              : m.selectionSource === "face"
                ? "face"
                : "search",
            faceMatchId: m.faceMatchId,
          },
        ]),
      ),
  );
  const [pickedUsers, setPickedUsers] = useState<Map<string, PocketUser>>(
    () => new Map(detail.members.map((m) => [m.userId, m.user])),
  );
  const [preview, setPreview] = useState<PocketSplit | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const hasRoundingRemainder =
    new Set(preview?.members.map((member) => member.shareCents)).size > 1;
  const matches = usePocketResource(
    useCallback(
      () => getPocketRecognition(detail.pocket.id, undefined, options),
      [detail.pocket.id, options],
    ),
  );
  const action = usePocketAction({
    transaction: true,
    reconcile: async () => {
      const latest = await getPocket(current.id, options);
      setCurrent(latest.pocket);
      setPreview(null);
      setConfirmed(false);
      onChanged();
      await matches.refreshFresh();
      return true;
    },
  });

  useEffect(() => {
    const term = query.trim();
    if (!term) return;
    let live = true;
    const timer = window.setTimeout(() => {
      void searchPocketParticipants(
        { pocketId: detail.pocket.id, query: term },
        options,
      )
        .then((response) => {
          if (live) {
            setResults({ query: term, ...response });
            setSearchError("");
          }
        })
        .catch((reason: unknown) => {
          if (live) {
            setResults({ query: term, users: [], nextPageToken: "" });
            setSearchError(pocketError(reason));
          }
        });
    }, 300);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [query, detail.pocket.id, options]);

  const allUsers = new Map(pickedUsers);
  allUsers.set(current.owner.id, current.owner);
  for (const member of detail.members) allUsers.set(member.userId, member.user);
  for (const match of matches.data ?? [])
    for (const candidate of match.candidates)
      allUsers.set(candidate.user.id, candidate.user);
  const currentResults = results?.query === query.trim() ? results : null;
  const currentSearchError = query.trim() && currentResults ? searchError : "";
  for (const user of currentResults?.users ?? []) allUsers.set(user.id, user);
  const visibleUsers = query.trim()
    ? (currentResults?.users ?? [])
    : [...allUsers.values()];
  const unknownMatches = (matches.data ?? []).filter(
    (match) =>
      !match.suggestedUserId &&
      !match.confirmedUserId &&
      match.resolution !== "ignored",
  );

  function select(user: PocketUser, checked: boolean) {
    setPreview(null);
    setConfirmed(false);
    setPickedUsers((previous) => new Map(previous).set(user.id, user));
    setSelected((previous) => {
      const next = new Map(previous);
      if (checked) {
        const face = matches.data?.find(
          (match) =>
            match.suggestedUserId === user.id ||
            match.confirmedUserId === user.id,
        );
        next.set(user.id, {
          userId: user.id,
          selectionSource:
            user.id === current.ownerId ? "owner" : face ? "face" : "search",
          faceMatchId: face?.id,
        });
      } else next.delete(user.id);
      return next;
    });
  }

  async function resolve(face: PocketFaceMatch, user?: PocketUser) {
    await action.run(
      `resolve:${face.id}:${user?.id ?? "ignore"}:${current.revision}`,
      async (requestId) => {
        const response = await resolvePocketFace(
          {
            pocketId: current.id,
            expectedRevision: current.revision,
            faceMatchId: face.id,
            userId: user?.id,
            ignore: !user,
            requestId,
          },
          options,
        );
        setCurrent(response.pocket);
        matches.refresh();
        setResolving(null);
        setQuery("");
        setPreview(null);
        if (user) select(user, true);
        onChanged();
      },
    );
  }

  function previewSelection() {
    const members = reconcilePocketSelections(
      [...selected.values()],
      current.ownerId,
      matches.data ?? [],
    ).sort((a, b) => a.userId.localeCompare(b.userId));
    void action.run(
      `members:${current.revision}:${JSON.stringify(members)}`,
      async (requestId) => {
        const response = await replacePocketMembers(
          {
            pocketId: current.id,
            expectedRevision: current.revision,
            members,
            requestId,
          },
          options,
        );
        setCurrent(response.pocket);
        onChanged();
        const split = await previewPocketSplit(
          { pocketId: current.id, expectedRevision: response.pocket.revision },
          options,
        );
        setPreview(split);
        setConfirmed(false);
      },
    );
  }

  return (
    <Drawer
      open
      onOpenChange={(open) => {
        if (!open && !action.busy) onClose();
      }}
      dismissible={!action.busy}
    >
      <DrawerContent className="max-h-[88dvh] overflow-clip sm:mx-auto sm:max-w-lg">
        <DrawerHeader className="shrink-0">
          <DrawerTitle>{preview ? "核对分摊金额" : "选择分摊人"}</DrawerTitle>
          <DrawerDescription
            className={
              (preview ? hasRoundingRemainder : matches.data?.length)
                ? "text-center"
                : "sr-only"
            }
          >
            {preview
              ? hasRoundingRemainder
                ? "部分成员多分摊 0.01 元"
                : "核对名单和每人金额后发起收款"
              : "识别结果仅供参考，请选择实际分摊的人"}
          </DrawerDescription>
        </DrawerHeader>
        {!preview ? (
          <FieldGroup className="shrink-0 gap-2 px-4 pb-3">
            <Field data-disabled={action.busy}>
              <FieldLabel className="sr-only" htmlFor="pocket-member-search">
                搜索姓名
              </FieldLabel>
              <InputGroup>
                <InputGroupAddon>
                  <RiSearchLine />
                </InputGroupAddon>
                <InputGroupInput
                  id="pocket-member-search"
                  placeholder={
                    resolving ? "输入姓名，关联这位未识别的人" : "搜索姓名"
                  }
                  value={query}
                  maxLength={100}
                  disabled={action.busy}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </InputGroup>
            </Field>
            {resolving ? (
              <div className="flex items-center justify-between gap-2 text-xs">
                <span>正在确认第 {resolving.faceIndex + 1} 张人脸</span>
                <Button
                  size="touch"
                  variant="ghost"
                  onClick={() => setResolving(null)}
                >
                  结束关联
                </Button>
              </div>
            ) : null}
          </FieldGroup>
        ) : null}
        <div className="app-scrollbar flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-4">
          <PocketError
            message={action.error || currentSearchError}
            retry={action.pending ? action.recover : undefined}
          />
          <PocketError
            message={
              matches.error ? "合照候选暂不可用，你可以继续搜索姓名选人" : ""
            }
            retry={matches.error ? matches.refresh : undefined}
          />
          {preview ? (
            <div className="flex flex-col gap-3">
              <dl className="divide-y divide-border/70 rounded-lg bg-muted/70 px-3">
                <div className="flex min-h-10 items-center justify-between gap-3 py-1.5">
                  <dt className="text-sm text-muted-foreground">总金额</dt>
                  <dd className="text-lg font-semibold tabular-nums text-primary">
                    {pocketMoney(preview.totalCents)}
                  </dd>
                </div>
                <div className="flex min-h-10 items-center justify-between gap-3 py-1.5 text-sm">
                  <dt className="text-muted-foreground">参与人数</dt>
                  <dd className="font-medium tabular-nums">
                    {preview.participantCount} 人
                  </dd>
                </div>
                <div className="flex min-h-10 items-center justify-between gap-3 py-1.5 text-sm">
                  <dt className="text-muted-foreground">自己承担</dt>
                  <dd className="font-medium tabular-nums">
                    {pocketMoney(preview.ownerShareCents)}
                  </dd>
                </div>
                <div className="flex min-h-10 items-center justify-between gap-3 py-1.5 text-sm">
                  <dt className="text-muted-foreground">应收合计</dt>
                  <dd className="font-medium tabular-nums">
                    {pocketMoney(preview.receivableCents)}
                  </dd>
                </div>
              </dl>
              <div className="divide-y divide-border/70">
                {preview.members.map((member) => (
                  <PocketPerson
                    key={member.userId}
                    user={member.user}
                    detail={member.isOwner ? "自身份额" : undefined}
                    action={
                      <span className="shrink-0 font-semibold tabular-nums">
                        {pocketMoney(member.shareCents)}
                      </span>
                    }
                  />
                ))}
              </div>
              <PocketConsent
                checked={confirmed}
                onChange={setConfirmed}
                disabled={action.busy}
              >
                已核对名单和金额，发起后不可修改
              </PocketConsent>
            </div>
          ) : (
            <>
              {!query.trim() && unknownMatches.length ? (
                <Card>
                  <CardHeader className="gap-1 p-3">
                    <CardTitle className="text-sm">
                      {unknownMatches.length} 张人脸待确认
                    </CardTitle>
                    <CardDescription className="leading-5">
                      搜索姓名关联，或跳过后手动添加
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2 px-3 pb-3">
                    {unknownMatches.map((face) => (
                      <div key={face.id} className="flex items-center gap-2">
                        <FaceCrop
                          face={face}
                          photo={detail.photos.find(
                            (photo) => photo.id === face.photoId,
                          )}
                        />
                        <span className="min-w-0 flex-1 text-sm">
                          第 {face.faceIndex + 1} 张人脸
                        </span>
                        <Button
                          size="touch"
                          variant="outline"
                          disabled={action.busy}
                          onClick={() => {
                            setResolving(face);
                            setQuery("");
                          }}
                        >
                          搜索
                        </Button>
                        <Button
                          size="touch"
                          variant="ghost"
                          disabled={action.busy}
                          onClick={() => void resolve(face)}
                        >
                          跳过
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ) : null}
              {query.trim() && !currentResults ? (
                <div
                  role="status"
                  className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground"
                >
                  <Spinner />
                  正在搜索姓名
                </div>
              ) : null}
              {currentResults?.users.length === 0 && !currentSearchError ? (
                <Empty
                  className="min-h-0 py-6"
                  title="没有找到该姓名"
                  description="对方需先登录商城"
                />
              ) : null}
              <div className="divide-y divide-border/70">
                {visibleUsers.map((user) => {
                  return (
                    <PocketPerson
                      key={user.id}
                      user={user}
                      detail={
                        user.id === current.ownerId ? "发起人" : undefined
                      }
                      action={
                        resolving ? (
                          <Button
                            size="touch"
                            disabled={action.busy}
                            onClick={() => void resolve(resolving, user)}
                          >
                            关联并选中
                          </Button>
                        ) : (
                          <label className="flex size-11 shrink-0 items-center justify-center">
                            <Checkbox
                              aria-label={`选择 ${user.name}`}
                              checked={selected.has(user.id)}
                              disabled={action.busy}
                              onCheckedChange={(value) =>
                                select(user, value === true)
                              }
                            />
                          </label>
                        )
                      }
                    />
                  );
                })}
              </div>
              {currentResults?.nextPageToken ? (
                <Button
                  variant="ghost"
                  size="touch"
                  className="w-full"
                  disabled={action.busy}
                  onClick={() =>
                    void action.run(
                      `search:${currentResults.nextPageToken}`,
                      async () => {
                        const response = await searchPocketParticipants(
                          {
                            pocketId: current.id,
                            query: currentResults.query,
                            pageToken: currentResults.nextPageToken,
                          },
                          options,
                        );
                        setResults((previous) =>
                          previous?.query === currentResults.query
                            ? {
                                query: currentResults.query,
                                users: [...previous.users, ...response.users],
                                nextPageToken: response.nextPageToken,
                              }
                            : previous,
                        );
                      },
                      { transaction: false, reconcile: undefined },
                    )
                  }
                >
                  更多搜索结果
                </Button>
              ) : null}
            </>
          )}
        </div>
        <DrawerFooter
          className={
            preview
              ? "border-t"
              : "flex-col items-stretch gap-3 border-t [&>[data-slot=button]]:flex-none"
          }
        >
          {preview ? (
            <>
              <Button
                variant="outline"
                size="touch"
                disabled={action.busy}
                onClick={() => setPreview(null)}
              >
                调整名单
              </Button>
              <Button
                size="touch"
                disabled={
                  action.busy || !confirmed || current.status !== "draft"
                }
                onClick={() =>
                  void action.run(
                    `publish:${preview.revision}`,
                    async (requestId) => {
                      await publishPocket(
                        {
                          pocketId: current.id,
                          expectedRevision: preview.revision,
                          requestId,
                        },
                        options,
                      );
                      if (!mounted.current) return;
                      onChanged();
                      onClose();
                      router.replace(`/pocket/${current.id}`);
                    },
                  )
                }
              >
                {action.busy ? <Spinner /> : null}发起收款
              </Button>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">
                  已选{" "}
                  <span className="font-medium tabular-nums text-foreground">
                    {selected.size}
                  </span>{" "}
                  人
                </span>
                <span className="font-medium tabular-nums">
                  合计 {pocketMoney(current.totalCents)}
                </span>
              </div>
              <div className="flex items-stretch gap-2">
                <Button
                  variant="outline"
                  size="touch"
                  className="min-w-0 flex-1"
                  disabled={action.busy}
                  onClick={onClose}
                >
                  取消
                </Button>
                <Button
                  size="touch"
                  className="h-auto min-h-11 min-w-0 flex-1 whitespace-normal py-2"
                  disabled={
                    action.busy ||
                    selected.size < 2 ||
                    current.status !== "draft"
                  }
                  onClick={previewSelection}
                >
                  {action.busy ? <Spinner /> : null}核对分摊金额
                </Button>
              </div>
            </>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

function FaceCrop({
  face,
  photo,
}: {
  face: PocketFaceMatch;
  photo?: PocketPhoto;
}) {
  const scale = 56 / Math.max(face.bbox.width, face.bbox.height, 1);
  if (!photo?.previewUrl)
    return (
      <span className="flex size-14 shrink-0 items-center justify-center rounded-md bg-background text-xs">
        待确认
      </span>
    );
  return (
    <div
      className="relative size-14 shrink-0 overflow-hidden rounded-md bg-background"
      aria-label={`合照中的第 ${face.faceIndex + 1} 张人脸`}
    >
      <div
        style={{
          position: "absolute",
          left: -face.bbox.x * scale,
          top: -face.bbox.y * scale,
          width: photo.width * scale,
          height: photo.height * scale,
        }}
      >
        <ManagedImage
          src={photo.previewUrl}
          alt="待确认的人脸"
          className="size-full"
        />
      </div>
    </div>
  );
}
