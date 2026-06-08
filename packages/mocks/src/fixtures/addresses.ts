export interface MockShippingAddress {
  id: string
  recipientName: string
  recipientPhone: string
  province: string
  city: string
  district: string
  detailAddress: string
  isDefault: boolean
}

export const mockShippingAddresses: MockShippingAddress[] = [
  {
    id: "1001",
    recipientName: "南邮同学",
    recipientPhone: "13800000001",
    province: "江苏省",
    city: "南京市",
    district: "栖霞区",
    detailAddress: "南京邮电大学仙林校区 SAST 活动室",
    isDefault: true,
  },
  {
    id: "1002",
    recipientName: "值班同学",
    recipientPhone: "13800000002",
    province: "江苏省",
    city: "南京市",
    district: "鼓楼区",
    detailAddress: "南京邮电大学三牌楼校区收发室",
    isDefault: false,
  },
]
