import { inject, intercept } from '@loopback/core'
import { Getter, repository } from '@loopback/repository'
import {
  post,
  param,
  get,
  getModelSchemaRef,
  requestBody,
  response,
  HttpErrors,
} from '@loopback/rest'
import { Classroom, CommentOnReview } from '../models'
import {
  ClassroomRepository,
  CommentOnReviewRepository,
  GradeReviewRepository,
  GradesRepository,
  StudentListRepository,
  UserClassroomRepository,
  UserRepository,
} from '../repositories'
import { UserProfile, SecurityBindings } from '@loopback/security'
import { CheckJoinClassroomInterceptor } from '../interceptors'
import { authenticate } from '@loopback/authentication'
import { ClassroomRole } from '../constants/role'
import {
  GradeReviewNotFoundError,
  NoPermissionError,
  StudentIdRequiredError,
} from '../common/error-hanlder'

@authenticate('jwt')
export class CommentOnReviewController {
  constructor(
    @repository(GradeReviewRepository)
    public gradeReviewRepository: GradeReviewRepository,
    @inject.getter(SecurityBindings.USER, { optional: true })
    private getCurrentUser: Getter<UserProfile>,
    @repository(UserRepository)
    public userRepository: UserRepository,
    @repository(GradesRepository)
    public gradesRepository: GradesRepository,
    @repository(StudentListRepository)
    public studentListRepository: StudentListRepository,
    @repository(UserClassroomRepository)
    public userClassroomRepository: UserClassroomRepository,
    @repository(ClassroomRepository)
    public classroomRepository: ClassroomRepository,
    @repository(CommentOnReviewRepository)
    public commentOnReviewRepository: CommentOnReviewRepository,
  ) {}

  @post('/classrooms/{classroomId}/grade-reviews/{gradeReviewId}/comments')
  @intercept(CheckJoinClassroomInterceptor.BINDING_KEY)
  @response(200, {
    description: 'Create a comment on a grade review',
    content: { 'application/json': { schema: getModelSchemaRef(CommentOnReview) } },
  })
  async create(
    @param.path.string('classroomId') classroomId: string,
    @param.path.number('gradeReviewId') gradeReviewId: number,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(CommentOnReview, {
            partial: true,
            exclude: ['id', 'createdAt', 'updatedAt', 'userId', 'gradeReviewId'],
          }),
        },
      },
    })
    commentOnReviewRequestBody: Omit<CommentOnReview, 'id'>,
  ): Promise<CommentOnReview> {
    const getUser = await this.getCurrentUser()

    await this.validateGardeReviewRole(gradeReviewId, classroomId, getUser.id)

    return this.commentOnReviewRepository.create({
      ...commentOnReviewRequestBody,
      userId: getUser.id,
      gradeReviewId: gradeReviewId,
    })
  }

  @post('/classrooms/{classroomId}/grade-reviews/{gradeReviewId}/comments/{commentId}')
  @intercept(CheckJoinClassroomInterceptor.BINDING_KEY)
  @response(204, {
    description: 'Update a comment on a grade review',
    content: { 'application/json': { schema: getModelSchemaRef(CommentOnReview) } },
  })
  async updateById(
    @param.path.string('classroomId') classroomId: string,
    @param.path.number('gradeReviewId') gradeReviewId: number,
    @param.path.number('commentId') commentId: number,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(CommentOnReview, {
            partial: true,
          }),
        },
      },
    })
    commentOnReviewRequestBody: CommentOnReview,
  ): Promise<CommentOnReview> {
    const getUser = await this.getCurrentUser()

    // check if user owns that grade review or user is teacher or host
    await this.validateGardeReviewRole(gradeReviewId, classroomId, getUser.id)



    const comment = await this.commentOnReviewRepository.findOne({
      where:{
        gradeReviewId: gradeReviewId,
        id: commentId
      }
    })
    if (!comment) throw new HttpErrors['404']('Không tìm thấy bình luận.')
    Object.assign(comment, commentOnReviewRequestBody)
    return this.commentOnReviewRepository.save(comment)
  }

  @get('/classrooms/{classroomId}/grade-reviews/{gradeReviewId}/comments')
  @intercept(CheckJoinClassroomInterceptor.BINDING_KEY)
  @response(200, {
    description: 'Find all CommentOnReview model instances by classroom id',
    content: {
      'application/json': {
        schema: getModelSchemaRef(CommentOnReview, { includeRelations: true }),
      },
    },
  })
  async findByGradeReview(
    @param.path.string('classroomId') classroomId: string,
    @param.path.number('gradeReviewId') gradeReviewId: number,
  ): Promise<CommentOnReview[]> {
    const getUser = await this.getCurrentUser()

    const userClassroom = await this.userClassroomRepository.findOne({
      where: {
        classroomId: classroomId,
        userId: getUser.id,
      },
      include: ['classroom', 'user'],
    })
    if (!userClassroom) return []
    const classroom: Classroom = userClassroom.classroom

    const gradeReview = await this.gradeReviewRepository.findOne({
      where: {
        id: gradeReviewId,
        classroomId: classroomId,
      },
    })
    if (!gradeReview) throw new HttpErrors['404']('Không tìm thấy đơn phúc khảo.')

    if (
      classroom.hostId === getUser.id ||
      userClassroom.userRole === ClassroomRole.TEACHER ||
      gradeReview.studentId === userClassroom.user.studentId
    ) {
      return this.commentOnReviewRepository.find({
        where: {
          gradeReviewId: gradeReviewId,
        },
        include: [
          {
            relation: 'user',
            scope: {
              fields: ['id', 'fullname', 'avatar', 'studentId'],
            },
          },
        ],
        order: ['createdAt ASC'],
      })
    } else {
      throw new NoPermissionError()
    }
  }

  /**
   * check if user owns this grade review or user is teacher or host
   * @param gradeReview
   * @param userClassroom
   * @param userId
   */
  async validateGardeReviewRole(gradeReviewId: number, classroomId: string, userId: number) {
    const gradeReview = await this.gradeReviewRepository.findOne({
      where: {
        id: gradeReviewId,
      },
    })
    if (!gradeReview) throw new GradeReviewNotFoundError()
    // if (gradeReview.studentId !==)

    const userClassroom = await this.userClassroomRepository.findOne({
      where: {
        classroomId: classroomId,
        userId: userId,
      },
      include: ['user', 'classroom'],
    })
    if (!userClassroom) throw new HttpErrors['404']('Không tìm thấy sinh viên.')
    if (!userClassroom?.user.studentId) throw new StudentIdRequiredError()

    if (
      gradeReview.studentId !== userClassroom.user.studentId &&
      userClassroom.classroom.hostId !== userId &&
      userClassroom.userRole !== ClassroomRole.TEACHER
    ) {
      throw new NoPermissionError()
    }
  }
}