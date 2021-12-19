/* eslint-disable linebreak-style */
import { Constructor, Getter, inject } from '@loopback/core'
import {
  BelongsToAccessor,
  DefaultCrudRepository,
  HasManyRepositoryFactory,
  repository,
} from '@loopback/repository'
import {
  ClassroomRepository,
  CommentOnReviewRepository,
} from '.'
import { DbDataSource } from '../datasources'
import { TimeStampRepositoryMixin } from '../mixins/time-stamp-repository.mixin'
import {
  Classroom,
  CommentOnReview,
  GradeReview,
  GradeReviewRelations,
} from '../models'

export class GradeReviewRepository extends TimeStampRepositoryMixin<
  GradeReview,
  typeof GradeReview.prototype.id | string,
  Constructor<
    DefaultCrudRepository<
      GradeReview,
      typeof GradeReview.prototype.id | string,
      GradeReviewRelations
    >
  >
>(DefaultCrudRepository) {
  public readonly classroom: BelongsToAccessor<Classroom, typeof Classroom.prototype.id>
  public readonly comments: HasManyRepositoryFactory<
    CommentOnReview,
    typeof CommentOnReview.prototype.id
  >
  constructor(
    @inject('datasources.db') dataSource: DbDataSource,
    @repository.getter('CommentOnReviewRepository')
    commentOnReviewRepository: Getter<CommentOnReviewRepository>,
    @repository.getter('ClassroomRepository')
    classroomRepository: Getter<ClassroomRepository>,
  ) {
    super(GradeReview, dataSource)

    this.classroom = this.createBelongsToAccessorFor('classroom', classroomRepository)
    this.registerInclusionResolver('classroom', this.classroom.inclusionResolver)

    this.comments = this.createHasManyRepositoryFactoryFor('comments', commentOnReviewRepository)
    this.registerInclusionResolver('comments', this.comments.inclusionResolver)
  }
}
