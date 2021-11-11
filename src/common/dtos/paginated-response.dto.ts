import { model, property } from "@loopback/repository"

@model()
export class PaginatedResponse<Type> {
  constructor(items: Type[], pageIndex: number, pageSize: number, totalItems: number) {
    this.items = items
    this.pageSize = pageSize
    this.pageIndex = pageIndex
    this.totalItems = totalItems

    this.totalPages = Math.ceil(this.totalItems / this.pageSize)
    this.hasPrevPage = this.pageIndex > 1
    this.hasNextPage = this.pageIndex < this.totalPages

  }
  
  @property.array(Object)
  items: Array<Type>
  
  @property({ type: 'number' })
  pageIndex: number
  
  @property({ type: 'number' })
  pageSize: number
  
  @property({ type: 'number' })
  totalItems: number
  
  @property({ type: 'boolean' })
  hasNextPage: boolean
  
  @property({ type: 'boolean' })
  hasPrevPage: boolean
  
  @property({ type: 'number' })
  totalPages: number
}
