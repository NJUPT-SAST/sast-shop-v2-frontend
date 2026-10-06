import { createClient } from "@connectrpc/connect";
import type { ServiceOptions } from "../data-source";
import { resolveDataSource } from "../data-source";
import { FeatureUnavailableError, ValidationError } from "../errors";
import { createLocalTransport, requestLocal } from "../local-connect";
import { formatProtoTimestamp, parseProtoTimestamp } from "../proto-timestamp";
import { BillService } from "../gen/sast/sastshopv2/payment/v1/bill_service_pb";
import { BillStatus } from "../gen/sast/sastshopv2/payment/v1/bill_pb";
import { mapPaymentBill, type PaymentBill } from "./payment-bills";
import type { UserInfo } from "../gen/sast/sastshopv2/user/v1/user_info_pb";
import {
  FaceProfileService,
  WestPocketService,
  type Pocket as ProtoPocket,
  type PocketMember as ProtoMember,
  type PocketPhoto as ProtoPhoto,
  type Job as ProtoJob,
  type FaceProfile as ProtoProfile,
  type FaceMatch as ProtoMatch,
  type Notification as ProtoNotification,
} from "../gen/sast/sastshopv2/westpocket/v1/west_pocket_pb";

export interface PocketUser {
  id: string;
  name: string;
  avatarUrl: string;
}
export interface WestPocket {
  id: string;
  ownerId: string;
  title: string;
  totalCents: number;
  status: string;
  revision: string;
  participantCount: number;
  ownerShareCents: number;
  receivableCents: number;
  createdAt: string | null;
  updatedAt: string | null;
  publishedAt: string | null;
  cancelReason: string;
  isOwner: boolean;
  owner: PocketUser;
}
export interface PocketMember {
  id: string;
  userId: string;
  user: PocketUser;
  selectionSource: string;
  faceMatchId: string | null;
  shareCents: number;
  paymentBillId: string | null;
  billStatus: string;
  billUpdatedAt: string | null;
  isOwner: boolean;
  albumAccess: string;
}
export interface PocketPhoto {
  id: string;
  pocketId: string;
  previewUrl: string;
  status: string;
  width: number;
  height: number;
  detectedFaceCount: number;
  retentionMode: string;
  retentionUntil: string | null;
  errorCode: string;
  latestRecognitionJobId: string | null;
}
export interface PocketJob {
  id: string;
  kind: string;
  status: string;
  totalItems: number;
  completedItems: number;
  failedItems: number;
  errorCode: string;
  retryable: boolean;
}
export interface PocketFaceProfile {
  id: string;
  status: string;
  revision: string;
  sampleCount: number;
  consentVersion: string;
  consentedAt: string | null;
  consentExpiresAt: string | null;
  revokedAt: string | null;
  jobId: string | null;
}
export interface PocketFaceMatch {
  id: string;
  photoId: string;
  recognitionJobId: string;
  faceIndex: number;
  bbox: { x: number; y: number; width: number; height: number };
  suggestedUserId: string | null;
  confirmedUserId: string | null;
  candidates: { user: PocketUser; score: number }[];
  matchStatus: string;
  resolution: string;
}
export interface PocketNotification {
  id: string;
  recipientUserId: string;
  kind: string;
  status: string;
  errorCode: string;
}
export interface PocketDetail {
  pocket: WestPocket;
  isOwner: boolean;
  members: PocketMember[];
  photos: PocketPhoto[];
  jobs: PocketJob[];
  notifications: PocketNotification[];
}
export interface PocketSplit {
  pocketId: string;
  revision: string;
  totalCents: number;
  participantCount: number;
  ownerShareCents: number;
  receivableCents: number;
  members: PocketMember[];
}
export interface PocketCapabilities {
  faceRecognitionAvailable: boolean;
  photoUploadAvailable: boolean;
  notificationsAvailable: boolean;
  faceConsentVersion: string;
  photoConsentVersion: string;
  maxPhotos: number;
  maxMembers: number;
  maxUploadBytes: number;
}
export interface PocketMemberSelection {
  userId: string;
  selectionSource: "face" | "search" | "owner";
  faceMatchId?: string | null;
}
export interface PocketMutation {
  pocketId: string;
  expectedRevision: string;
  requestId: string;
}
export interface PocketPayment {
  pocket: WestPocket;
  bill: PaymentBill | null;
  payee: PocketUser | null;
  qrContent: string;
  isOwner: boolean;
}

const maxInt64 = 9223372036854775807n;
function id(value: string): bigint {
  if (!/^[1-9]\d*$/.test(value) || BigInt(value) > maxInt64)
    throw new ValidationError("标识或版本不正确，请刷新后重试");
  return BigInt(value);
}
function optionalId(value: bigint): string | null {
  return value > 0n ? value.toString() : null;
}
function required<T>(value: T | undefined, feature: string): T {
  if (value === undefined) throw new FeatureUnavailableError(feature);
  return value;
}
function clients(options: ServiceOptions) {
  if (!["mock", "local"].includes(resolveDataSource(options)))
    throw new FeatureUnavailableError("westPocket");
  const transport = createLocalTransport(options);
  return {
    pocket: createClient(WestPocketService, transport),
    face: createClient(FaceProfileService, transport),
    bill: createClient(BillService, transport),
  };
}
function requestPocket<T>(
  feature: string,
  request: () => Promise<T>,
): Promise<T> {
  // Build/validate the request before translating asynchronous transport errors.
  const pending = request();
  return requestLocal(feature, () => pending);
}
function mutation(input: PocketMutation) {
  return {
    pocketId: id(input.pocketId),
    expectedRevision: id(input.expectedRevision),
    requestId: input.requestId,
  };
}
function amount(totalCents: number) {
  if (
    !Number.isInteger(totalCents) ||
    totalCents <= 0 ||
    totalCents > 2147483647
  )
    throw new ValidationError("金额需为有效的整数分");
  return totalCents;
}
function user(value: UserInfo | undefined, fallbackId = ""): PocketUser {
  return {
    id: value?.id.toString() ?? fallbackId,
    name: value?.name || `用户 ${fallbackId}`,
    avatarUrl: value?.avatarUrl ?? "",
  };
}
function pocket(value: ProtoPocket): WestPocket {
  return {
    id: value.id.toString(),
    ownerId: value.ownerId.toString(),
    title: value.title,
    totalCents: value.totalCents,
    status: value.status,
    revision: value.revision.toString(),
    participantCount: value.participantCount,
    ownerShareCents: value.ownerShareCents,
    receivableCents: value.receivableCents,
    createdAt: formatProtoTimestamp(value.createdAt),
    updatedAt: formatProtoTimestamp(value.updatedAt),
    publishedAt: formatProtoTimestamp(value.publishedAt),
    cancelReason: value.cancelReason,
    isOwner: value.isOwner,
    owner: user(value.owner, value.ownerId.toString()),
  };
}
function member(value: ProtoMember): PocketMember {
  return {
    id: value.id.toString(),
    userId: value.userId.toString(),
    user: user(value.user, value.userId.toString()),
    selectionSource: value.selectionSource,
    faceMatchId: optionalId(value.faceMatchId),
    shareCents: value.shareCents,
    paymentBillId: optionalId(value.paymentBillId),
    billStatus: value.billStatus,
    billUpdatedAt: formatProtoTimestamp(value.billUpdatedAt),
    isOwner: value.isOwner,
    albumAccess: value.albumAccess,
  };
}
function photo(value: ProtoPhoto): PocketPhoto {
  return {
    id: value.id.toString(),
    pocketId: value.pocketId.toString(),
    previewUrl: value.previewUrl,
    status: value.status,
    width: value.width,
    height: value.height,
    detectedFaceCount: value.detectedFaceCount,
    retentionMode: value.retentionMode,
    retentionUntil: formatProtoTimestamp(value.retentionUntil),
    errorCode: value.errorCode,
    latestRecognitionJobId: optionalId(value.latestRecognitionJobId),
  };
}
function job(value: ProtoJob): PocketJob {
  return {
    id: value.id.toString(),
    kind: value.kind,
    status: value.status,
    totalItems: value.totalItems,
    completedItems: value.completedItems,
    failedItems: value.failedItems,
    errorCode: value.errorCode,
    retryable: value.retryable,
  };
}
function profile(value: ProtoProfile): PocketFaceProfile {
  return {
    id: value.id.toString(),
    status: value.status,
    revision: value.revision.toString(),
    sampleCount: value.sampleCount,
    consentVersion: value.consentVersion,
    consentedAt: formatProtoTimestamp(value.consentedAt),
    consentExpiresAt: formatProtoTimestamp(value.consentExpiresAt),
    revokedAt: formatProtoTimestamp(value.revokedAt),
    jobId: optionalId(value.jobId),
  };
}
function match(value: ProtoMatch): PocketFaceMatch {
  return {
    id: value.id.toString(),
    photoId: value.photoId.toString(),
    recognitionJobId: value.recognitionJobId.toString(),
    faceIndex: value.faceIndex,
    bbox: {
      x: value.bboxX,
      y: value.bboxY,
      width: value.bboxWidth,
      height: value.bboxHeight,
    },
    suggestedUserId: optionalId(value.suggestedUserId),
    confirmedUserId: optionalId(value.confirmedUserId),
    candidates: value.candidates
      .filter((c) => c.user)
      .map((c) => ({ user: user(c.user), score: c.score })),
    matchStatus: value.matchStatus,
    resolution: value.resolution,
  };
}
function notification(value: ProtoNotification): PocketNotification {
  return {
    id: value.id.toString(),
    recipientUserId: value.recipientUserId.toString(),
    kind: value.kind,
    status: value.status,
    errorCode: value.errorCode,
  };
}

export async function getPocketCapabilities(
  options: ServiceOptions = {},
): Promise<PocketCapabilities> {
  const response = await requestPocket("getPocketCapabilities", () =>
    clients(options).pocket.getCapabilities({}),
  );
  return {
    faceRecognitionAvailable: response.faceRecognitionAvailable,
    photoUploadAvailable: response.photoUploadAvailable,
    notificationsAvailable: response.notificationsAvailable,
    faceConsentVersion: response.faceConsentVersion,
    photoConsentVersion: response.photoConsentVersion,
    maxPhotos: response.maxPhotos,
    maxMembers: response.maxMembers,
    maxUploadBytes: response.maxUploadBytes,
  };
}
export async function createPocket(
  input: { title: string; totalCents: number; requestId: string },
  options: ServiceOptions = {},
): Promise<WestPocket> {
  const response = await requestPocket("createPocket", () =>
    clients(options).pocket.createPocket({
      ...input,
      totalCents: amount(input.totalCents),
    }),
  );
  return pocket(required(response.pocket, "createPocket"));
}
export async function updatePocket(
  input: PocketMutation & { title?: string; totalCents?: number },
  options: ServiceOptions = {},
): Promise<WestPocket> {
  const response = await requestPocket("updatePocket", () =>
    clients(options).pocket.updatePocket({
      ...mutation(input),
      title: input.title,
      totalCents:
        input.totalCents === undefined ? undefined : amount(input.totalCents),
    }),
  );
  return pocket(required(response.pocket, "updatePocket"));
}
export async function getPocket(
  pocketId: string,
  options: ServiceOptions = {},
): Promise<PocketDetail> {
  const response = await requestPocket("getPocket", () =>
    clients(options).pocket.getPocket({ pocketId: id(pocketId) }),
  );
  return {
    pocket: pocket(required(response.pocket, "getPocket")),
    isOwner: response.isOwner,
    members: response.members.map(member),
    photos: response.photos.map(photo),
    jobs: response.jobs.map(job),
    notifications: response.notifications.map(notification),
  };
}
export async function listMyPockets(
  input: { perspective: "owner" | "member"; pageToken?: string },
  options: ServiceOptions = {},
): Promise<{ pockets: WestPocket[]; nextPageToken: string }> {
  const response = await requestPocket("listMyPockets", () =>
    clients(options).pocket.listMyPockets({ ...input, pageSize: 20 }),
  );
  return {
    pockets: response.pockets.map(pocket),
    nextPageToken: response.nextPageToken,
  };
}
export async function addPocketPhotos(
  input: PocketMutation & {
    uploadIds: string[];
    retentionMode: "temporary" | "keepsake";
    captureAuthorizationVersion: string;
  },
  options: ServiceOptions = {},
) {
  const response = await requestPocket("addPocketPhotos", () =>
    clients(options).pocket.addPocketPhotos({ ...input, ...mutation(input) }),
  );
  return {
    pocket: pocket(required(response.pocket, "addPocketPhotos")),
    photos: response.photos.map(photo),
  };
}
export async function deletePocketPhoto(
  input: { pocketId: string; photoId: string; requestId: string },
  options: ServiceOptions = {},
) {
  await requestPocket("deletePocketPhoto", () =>
    clients(options).pocket.deletePocketPhoto({
      ...input,
      pocketId: id(input.pocketId),
      photoId: id(input.photoId),
    }),
  );
}
export async function startPocketRecognition(
  input: { pocketId: string; photoIds: string[]; requestId: string },
  options: ServiceOptions = {},
): Promise<PocketJob> {
  const response = await requestPocket("startPocketRecognition", () =>
    clients(options).pocket.startRecognition({
      ...input,
      pocketId: id(input.pocketId),
      photoIds: input.photoIds.map(id),
    }),
  );
  return job(required(response.job, "startPocketRecognition"));
}
export async function getPocketJob(
  jobId: string,
  options: ServiceOptions = {},
): Promise<PocketJob> {
  const response = await requestPocket("getPocketJob", () =>
    clients(options).pocket.getJob({ jobId: id(jobId) }),
  );
  return job(required(response.job, "getPocketJob"));
}
export async function retryPocketJob(
  input: { jobId: string; requestId: string },
  options: ServiceOptions = {},
): Promise<PocketJob> {
  const response = await requestPocket("retryPocketJob", () =>
    clients(options).pocket.retryJob({ ...input, jobId: id(input.jobId) }),
  );
  return job(required(response.job, "retryPocketJob"));
}
export async function getPocketRecognition(
  pocketId: string,
  jobId?: string,
  options: ServiceOptions = {},
): Promise<PocketFaceMatch[]> {
  const response = await requestPocket("getPocketRecognition", () =>
    clients(options).pocket.getRecognitionResults({
      pocketId: id(pocketId),
      jobId: jobId ? id(jobId) : 0n,
    }),
  );
  return response.matches.map(match);
}
export async function resolvePocketFace(
  input: PocketMutation & {
    faceMatchId: string;
    userId?: string;
    ignore?: boolean;
  },
  options: ServiceOptions = {},
) {
  const response = await requestPocket("resolvePocketFace", () =>
    clients(options).pocket.resolveFaceMatch({
      ...mutation(input),
      faceMatchId: id(input.faceMatchId),
      userId: input.userId ? id(input.userId) : 0n,
      ignore: input.ignore ?? false,
    }),
  );
  return {
    pocket: pocket(required(response.pocket, "resolvePocketFace")),
    match: match(required(response.match, "resolvePocketFace")),
  };
}
export async function searchPocketParticipants(
  input: { pocketId: string; query: string; pageToken?: string },
  options: ServiceOptions = {},
) {
  const response = await requestPocket("searchPocketParticipants", () =>
    clients(options).pocket.searchParticipants({
      ...input,
      pocketId: id(input.pocketId),
      pageSize: 20,
    }),
  );
  return {
    users: response.users.map((u) => user(u)),
    nextPageToken: response.nextPageToken,
  };
}
export async function replacePocketMembers(
  input: PocketMutation & { members: PocketMemberSelection[] },
  options: ServiceOptions = {},
) {
  if (new Set(input.members.map((m) => m.userId)).size !== input.members.length)
    throw new ValidationError("名单中有重复用户");
  const response = await requestPocket("replacePocketMembers", () =>
    clients(options).pocket.replaceMembers({
      ...mutation(input),
      members: input.members.map((m) => ({
        userId: id(m.userId),
        selectionSource: m.selectionSource,
        faceMatchId: m.faceMatchId ? id(m.faceMatchId) : 0n,
      })),
    }),
  );
  return {
    pocket: pocket(required(response.pocket, "replacePocketMembers")),
    members: response.members.map(member),
  };
}
export async function previewPocketSplit(
  input: { pocketId: string; expectedRevision: string },
  options: ServiceOptions = {},
): Promise<PocketSplit> {
  const response = await requestPocket("previewPocketSplit", () =>
    clients(options).pocket.previewSplit({
      pocketId: id(input.pocketId),
      expectedRevision: id(input.expectedRevision),
    }),
  );
  return {
    pocketId: response.pocketId.toString(),
    revision: response.revision.toString(),
    totalCents: response.totalCents,
    participantCount: response.participantCount,
    ownerShareCents: response.ownerShareCents,
    receivableCents: response.receivableCents,
    members: response.members.map(member),
  };
}
export async function publishPocket(
  input: PocketMutation,
  options: ServiceOptions = {},
) {
  const response = await requestPocket("publishPocket", () =>
    clients(options).pocket.publishPocket(mutation(input)),
  );
  return {
    pocket: pocket(required(response.pocket, "publishPocket")),
    job: response.job ? job(response.job) : null,
  };
}
export async function getPocketPayment(
  pocketId: string,
  options: ServiceOptions = {},
): Promise<PocketPayment> {
  const response = await requestPocket("getPocketPayment", () =>
    clients(options).pocket.getMyPayment({ pocketId: id(pocketId) }),
  );
  return {
    pocket: pocket(required(response.pocket, "getPocketPayment")),
    bill: response.bill ? mapPaymentBill(response.bill) : null,
    payee: response.payee ? user(response.payee) : null,
    qrContent: response.qrContent,
    isOwner: response.isOwner,
  };
}
export async function cancelPocket(
  input: PocketMutation & { reason?: string },
  options: ServiceOptions = {},
) {
  const response = await requestPocket("cancelPocket", () =>
    clients(options).pocket.cancelPocket({
      ...mutation(input),
      reason: input.reason ?? "",
    }),
  );
  return {
    pocket: pocket(required(response.pocket, "cancelPocket")),
    job: response.job ? job(response.job) : null,
  };
}

export async function rejectPocketPayment(
  input: { billId: string; updatedAt: string },
  options: ServiceOptions = {},
): Promise<PaymentBill> {
  const response = await requestPocket("rejectPocketPayment", () =>
    clients(options).bill.transitionBill({
      billId: id(input.billId),
      targetStatus: BillStatus.UNPAID,
      updatedAt: parseProtoTimestamp(input.updatedAt, "账单更新时间不正确"),
    }),
  );
  return mapPaymentBill(required(response.bill, "rejectPocketPayment"));
}
export async function remindPocketMembers(
  input: { pocketId: string; memberIds: string[]; requestId: string },
  options: ServiceOptions = {},
) {
  const response = await requestPocket("remindPocketMembers", () =>
    clients(options).pocket.remindMembers({
      ...input,
      pocketId: id(input.pocketId),
      memberIds: input.memberIds.map(id),
    }),
  );
  return response.notifications.map(notification);
}
export async function setPocketAlbumAccess(
  input: { pocketId: string; accepted: boolean; requestId: string },
  options: ServiceOptions = {},
) {
  await requestPocket("setPocketAlbumAccess", () =>
    clients(options).pocket.setAlbumAccess({
      ...input,
      pocketId: id(input.pocketId),
    }),
  );
}
export async function listPocketAlbum(
  input: { pocketId: string; pageToken?: string },
  options: ServiceOptions = {},
) {
  const response = await requestPocket("listPocketAlbum", () =>
    clients(options).pocket.listAlbumPhotos({
      ...input,
      pocketId: id(input.pocketId),
      pageSize: 20,
    }),
  );
  return {
    photos: response.photos.map(photo),
    nextPageToken: response.nextPageToken,
  };
}
export async function getMyPocketFace(
  options: ServiceOptions = {},
): Promise<PocketFaceProfile | null> {
  const response = await requestPocket("getMyPocketFace", () =>
    clients(options).face.getMyFaceProfile({}),
  );
  return response.faceProfile ? profile(response.faceProfile) : null;
}
export async function enrollPocketFace(
  input: {
    uploadIds: string[];
    consentVersion: string;
    requestId: string;
    expectedRevision?: string;
  },
  options: ServiceOptions = {},
) {
  const response = await requestPocket<{
    faceProfile?: ProtoProfile;
    job?: ProtoJob;
  }>("enrollPocketFace", () =>
    input.expectedRevision
      ? clients(options).face.replaceMyFace({
          ...input,
          expectedRevision: id(input.expectedRevision),
        })
      : clients(options).face.enrollMyFace(input),
  );
  return {
    profile: profile(required(response.faceProfile, "enrollPocketFace")),
    job: response.job ? job(response.job) : null,
  };
}
export async function revokePocketFace(
  input: { expectedRevision: string; requestId: string },
  options: ServiceOptions = {},
) {
  const response = await requestPocket("revokePocketFace", () =>
    clients(options).face.revokeMyFace({
      ...input,
      expectedRevision: id(input.expectedRevision),
    }),
  );
  return {
    profile: profile(required(response.faceProfile, "revokePocketFace")),
    job: response.job ? job(response.job) : null,
  };
}
