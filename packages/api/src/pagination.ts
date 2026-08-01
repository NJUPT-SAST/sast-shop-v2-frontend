/*
分页结果标准化构造器（泛型TS）用于后端接口返回分页数据
统一生成规范分页对象 PageResult<T>，同时强制校验分页参数合法性，非法分页直接抛出业务异常，防止脏数据流向前端。
*/
import { FeatureUnavailableError } from "./errors";
//输出接口
export interface PageResult<T> {
  items: T[];
  currentPage: number;
  pageSize: number;
  totalCount: number;
  hasMore: boolean; //是否还有下一页
}
//入参配置接口：调用createPageResult需要传入的参数
interface CreatePageResultInput<T> {
  items: T[]; //当前页查询出来的数组数据
  currentPage: number; //数据库查询使用的页码
  pageSize: number;
  totalCount: number;
  expectedPage: number;
  feature: string;
  hasMore?: boolean;
  maxItems?: number;
  validateOffset?: boolean; //是否开启偏移量合法性校验
}

export function createPageResult<T>({
  items,
  currentPage,
  pageSize,
  totalCount,
  expectedPage,
  feature,
  hasMore,
  maxItems = pageSize,
  validateOffset = true,
}: CreatePageResultInput<T>): PageResult<T> {
  if (
    !Number.isInteger(currentPage) ||
    currentPage !== expectedPage ||
    !Number.isInteger(pageSize) ||
    pageSize <= 0 ||
    !Number.isInteger(totalCount) ||
    totalCount < 0 ||
    items.length > maxItems ||
    (validateOffset &&
      items.length > 0 &&
      totalCount < (currentPage - 1) * pageSize + items.length)
    //(currentPage - 1) * pageSize 偏移 offset
    //offset + items.length    当前分页读到最后一条数据在全局数据里的位置
  ) {
    throw new FeatureUnavailableError(`${feature}.pagination`);
  }

  return {
    items,
    currentPage,
    pageSize,
    totalCount,
    hasMore: hasMore ?? currentPage * pageSize < totalCount,
  };
}
