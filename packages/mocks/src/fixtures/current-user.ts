export interface MockUser {
  id: string;
  name: string;
  department: string;
  avatarUrl: string;
}

export const currentUser: MockUser = {
  id: "mock-user-001",
  name: "南邮同学",
  department: "SAST",
  avatarUrl: "https://api.dicebear.com/9.x/initials/svg?seed=SAST"
};
