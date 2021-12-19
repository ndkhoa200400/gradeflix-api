/* eslint-disable linebreak-style */
import { Constructor, Getter, inject } from '@loopback/core'
import { BelongsToAccessor, DefaultCrudRepository, repository } from '@loopback/repository'
import { UserRepository } from '.'
import { DbDataSource } from '../datasources'
import { TimeStampRepositoryMixin } from '../mixins/time-stamp-repository.mixin'
import { CommentOnReview, CommentOnReviewRelations, GradeReview, User } from '../models'
import { GradeReviewRepository } from './grade-review.repository'

export class CommentOnReviewRepository extends TimeStampRepositoryMixin<
  CommentOnReview,
  typeof CommentOnReview.prototype.id | string,
  Constructor<
    DefaultCrudRepository<
      CommentOnReview,
      typeof CommentOnReview.prototype.id | string,
      CommentOnReviewRelations
    >
  >
>(DefaultCrudRepository) {
  public readonly gradeReview: BelongsToAccessor<GradeReview, typeof GradeReview.prototype.id>
  public readonly user: BelongsToAccessor<User, typeof User.prototype.id>

  constructor(
    @inject('datasources.db')
    dataSource: DbDataSource,
    @repository.getter('GradeReviewRepository')
    gradeReviewRepository: Getter<GradeReviewRepository>,
    @repository.getter('UserRepository')
    userRepository: Getter<UserRepository>,
  ) {
    super(CommentOnReview, dataSource)
    this.gradeReview = this.createBelongsToAccessorFor('gradeReview', gradeReviewRepository)
    this.registerInclusionResolver('gradeReview', this.gradeReview.inclusionResolver)

    this.user = this.createBelongsToAccessorFor('user', userRepository)
    this.registerInclusionResolver('user', this.user.inclusionResolver)
  }
}
