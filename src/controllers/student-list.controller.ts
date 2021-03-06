import { authenticate } from '@loopback/authentication'
import { UserServiceBindings } from '@loopback/authentication-jwt'
import { inject, intercept } from '@loopback/core'
import { Filter, repository } from '@loopback/repository'
import {
  param,
  response,
  get,
  post,
  requestBody,
  Request,
  RestBindings,
  Response,
  HttpErrors,
  getModelSchemaRef,
} from '@loopback/rest'
import { Grades, StudentList, StudentListResponse, UploadFileResponse } from '../models'
import {
  ClassroomRepository,
  GradesRepository,
  StudentListRepository,
  UserClassroomRepository,
  UserRepository,
} from '../repositories'
import { MyUserService } from '../services'
import { AuthenRoleClassroomInterceptor } from '../interceptors'
import { FILE_UPLOAD_SERVICE } from '../keys'
import { RequestHandler } from 'express-serve-static-core'
import _ from 'lodash'
import * as XLSX from 'xlsx'
import { CheckJoinClassroomInterceptor } from '../interceptors/'
import { StudentListHeaders } from '../constants/student-list-header'
import calculateTotal from '../common/helpers/calculate-grade-total'
import { validateGrade } from '../common/helpers'

@authenticate('jwt')
export class StudentListController {
  constructor(
    @repository(ClassroomRepository)
    public classroomRepository: ClassroomRepository,
    @repository(StudentListRepository)
    public studentListRepository: StudentListRepository,
    @repository(UserClassroomRepository)
    public userClassroomRepository: UserClassroomRepository,
    @repository(UserRepository)
    public userRepository: UserRepository,
    @repository(GradesRepository)
    public gradesRepository: GradesRepository,
    @inject(UserServiceBindings.USER_SERVICE)
    public userService: MyUserService,
    @inject(FILE_UPLOAD_SERVICE) private handler: RequestHandler,
  ) {}

  @intercept(AuthenRoleClassroomInterceptor.BINDING_KEY)
  @get('/classrooms/{id}/student-list')
  @response(200, {
    description: 'Find student list from a classroom',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(StudentListResponse),
        },
      },
    },
  })
  async find(
    @param.path.string('id') classroomId: string,
    @param.filter(StudentList) filter?: Filter<StudentList>,
  ): Promise<StudentListResponse[]> {
    filter = filter ?? ({} as Filter<StudentList>)

    filter.include = [...(filter.include ?? []), 'grades']
    filter.where = { ...filter.where, classroomId: classroomId }
    const studentList = await this.studentListRepository.find(filter)
    const studentListResponse: StudentListResponse[] = []
    const userClassrooms = await this.userClassroomRepository.find({
      where: {
        classroomId: classroomId,
      },
    })
    const userIds = userClassrooms.map(item => item.userId)
    for (const student of studentList) {
      const user = await this.userRepository.findOne({
        where: {
          studentId: student.studentId,
          id: { inq: userIds },
        },
      })
      const temp: StudentListResponse = new StudentListResponse({
        ...student,
        user: user,
      })
      studentListResponse.push(temp)
    }
    return studentListResponse
  }

  @intercept(CheckJoinClassroomInterceptor.BINDING_KEY)
  @get('/classrooms/{classroomId}/students/{studentId}/grades')
  @response(200, {
    description: 'Get one student grades',
  })
  async getStudentGrade(
    @param.path.string('classroomId') classroomId: string,
    @param.path.string('studentId') studentId: string,
  ): Promise<StudentList | null> {
    const studentList = await this.studentListRepository.findOne({
      where: {
        classroomId: classroomId,
        studentId: studentId,
      },
      include: ['grades'],
    })

    return studentList
  }

  @intercept(AuthenRoleClassroomInterceptor.BINDING_KEY)
  @post('/classrooms/{id}/student-list')
  @response(200, {
    description: 'Upload student list',
  })
  async uploadStudentList(
    @param.path.string('id') classroomId: string,
    @requestBody.file()
    body: Request,
    @inject(RestBindings.Http.RESPONSE) res: Response,
  ): Promise<UploadFileResponse> {
    // Processing files from request body
    await new Promise<object>((resolve, reject) => {
      this.handler(body, res, (err: unknown) => {
        if (err) reject(err)
        else {
          resolve(StudentListController.getFilesAndFields(body))
        }
      })
    })

    if (body.files?.length === 0)
      throw new HttpErrors['400']('Vui l??ng ch???n m???t file excel ????? ti???p t???c.')

    const workbook: XLSX.WorkBook = XLSX.read(_.get(body, 'files[0].buffer'), {
      type: 'buffer',
      WTF: true,
    })
    const data = this.mapFileToJson(workbook)

    /* 
      data l?? m???ng 2 chi???u, ph???n t??? l?? m???t m???ng 2 ph???n t??? g???m mssv v?? h??? t??n
      Ph???n t??? ?????u l?? headers
      [
        ['M?? s??? sinh vi??n', 'H??? v?? t??n'],
        ['123456', 'hs1']
      ]
    */
    if (data.length === 0) {
      throw new HttpErrors['400']('?????nh d???ng file kh??ng ????ng. Vui l??ng ki???m tra l???i.')
    }

    // validate headers
    const headers = data[0]
    if (
      !headers.includes(StudentListHeaders.STUDENT_ID) ||
      !headers.includes(StudentListHeaders.FULLNAME)
    )
      throw new HttpErrors['400']('?????nh d???ng file kh??ng ????ng. Vui l??ng ki???m tra l???i.')

    const promiseAll: Promise<StudentList>[] = []
    const studentListCreation: StudentList[] = []
    const errorList: string[] = []
    await this.removePreviousStudentList(classroomId)

    for (let i = 1; i < data.length; i++) {
      const studentInfo = data[i]

      // Missing information
      if (studentInfo.length !== 2) {
        errorList.push(studentInfo[0])
        continue
      }
      const student = await this.studentListRepository.findOne({
        where: {
          studentId: studentInfo[0],
          classroomId: classroomId,
        },
      })
      if (!student) {
        studentListCreation.push(
          new StudentList({
            classroomId: classroomId,
            studentId: studentInfo[0],
            fullName: studentInfo[1],
          }),
        )
      } else {
        if (student.fullName !== studentInfo[1]) {
          student.fullName = studentInfo[1]
          promiseAll.push(this.studentListRepository.save(student))
        }
      }
    }
    if (studentListCreation.length > 0)
      await this.studentListRepository.createAll(studentListCreation)
    await Promise.all(promiseAll)
    const studentList = await this.studentListRepository.find({
      where: {
        classroomId: classroomId,
      },
      include: ['grades'],
    })
    return { studentList, errorList }
  }

  @intercept(AuthenRoleClassroomInterceptor.BINDING_KEY)
  @post('/classrooms/{classroomId}/students/{studentId}/grades')
  @response(200, {
    description: 'Update one student grade with gradeName and studentId',
  })
  async updateStudentGrade(
    @param.path.string('classroomId') classroomId: string,
    @param.path.string('studentId') studentId: string,
    @param.query.string('gradeName') gradeName: string,
    @requestBody({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              newGrade: {
                type: 'string',
              },
            },
          },
        },
      },
    })
    body: { newGrade: 'string' },
  ): Promise<StudentList | null> {
    const studentList = await this.studentListRepository.findOne({
      where: { studentId: studentId, classroomId: classroomId },
    })

    if (!studentList)
      throw new HttpErrors['404'](`Kh??ng t??m th???y h???c sinh v???i m?? s??? sinh vi??n ${studentId}.`)

    const classroom = await this.classroomRepository.findById(classroomId)

    const gradeStructure = classroom.gradeStructure
    if (!gradeStructure) throw new HttpErrors['400'](`Vui l??ng th??m c???u tr??c ??i???m cho l???p h???c.`)

    if (
      !gradeStructure.gradeCompositions.find(
        gradeComposition => gradeComposition.name === gradeName,
      )
    )
      throw new HttpErrors['400'](`L???p h???c kh??ng c?? thang ??i???m ${gradeName}.`)

    const grade = await this.gradesRepository.findOne({
      where: {
        studentListId: studentList.id,
        name: gradeName,
      },
    })

    if (!validateGrade(body.newGrade, gradeStructure))
      throw new HttpErrors['400']('??i???m kh??ng h???p l???. Vui l??ng ki???m tra l???i.')

    // N???u ch??a c?? ??i???m => t???o
    if (!grade) {
      await this.gradesRepository.create({
        studentListId: studentList.id,
        name: gradeName,
        grade: body.newGrade,
      })
    } else {
      // N???u ???? c?? ??i???m => c???p nh???t
      grade.grade = body.newGrade
      await this.gradesRepository.save(grade)
    }
    const grades = await this.gradesRepository.find({
      where: {
        studentListId: studentList.id,
      },
    })
    const total = calculateTotal(grades, gradeStructure)
    if (total !== studentList.total) {
      studentList.total = total
      await this.studentListRepository.save(studentList)
    }
    return this.studentListRepository.findOne({
      where: {
        classroomId: classroomId,
        studentId: studentList.studentId,
      },
      include: ['grades'],
    })
  }

  @intercept(AuthenRoleClassroomInterceptor.BINDING_KEY)
  @post('/classrooms/{id}/student-grades')
  @response(200, {
    description: 'Upload student grades',
  })
  async uploadStudentGrades(
    @param.path.string('id') classroomId: string,
    @param.query.string('gradeName') gradeName: string,
    @requestBody.file()
    body: Request,
    @inject(RestBindings.Http.RESPONSE) res: Response,
  ): Promise<UploadFileResponse> {
    // Processing files from request body
    await new Promise<object>((resolve, reject) => {
      this.handler(body, res, (err: unknown) => {
        if (err) reject(err)
        else {
          resolve(StudentListController.getFilesAndFields(body))
        }
      })
    })

    if (body.files?.length === 0)
      throw new HttpErrors['400']('Vui l??ng ch???n m???t file excel ????? ti???p t???c.')

    const workbook: XLSX.WorkBook = XLSX.read(_.get(body, 'files[0].buffer'), {
      type: 'buffer',
      WTF: true,
    })

    /* 
      data l?? m???ng 2 chi???u, ph???n t??? l?? m???t m???ng 2 ph???n t??? g???m mssv v?? ??i???m s???
      Ph???n t??? ?????u l?? headers
      [
        ['M?? s??? sinh vi??n', '??i???m'],
        ['123456', '8']
      ]
    */
    const data = this.mapFileToJson(workbook)

    if (data.length === 0)
      throw new HttpErrors['400']('?????nh d???ng file kh??ng ????ng. Vui l??ng ki???m tra l???i.')

    // validate headers
    const headers = data[0]
    if (
      !headers.includes(StudentListHeaders.STUDENT_ID) ||
      !headers.includes(StudentListHeaders.GRADE)
    )
      throw new HttpErrors['400']('?????nh d???ng file kh??ng ????ng. Vui l??ng ki???m tra l???i.')

    // validate whether gradeName exists in gradeStructure
    const classroom = await this.classroomRepository.findById(classroomId)

    const gradeStructure = classroom.gradeStructure
    if (!gradeStructure) throw new HttpErrors['400']('Vui l??ng th??m c???u tr??c ??i???m cho l???p h???c.')

    const scale = gradeStructure.gradeCompositions.find(
      gradeComposition => gradeComposition.name === gradeName,
    )
    if (!scale) throw new HttpErrors['400'](`Thang ??i???m ${gradeName} kh??ng t???n t???i.`)

    // Validate whether classroom has a student list or not
    const studentListCount = await this.studentListRepository.count({
      classroomId: classroomId,
    })
    if (studentListCount.count === 0)
      throw new HttpErrors['400']('Vui l??ng th??m danh s??ch l???p h???c.')

    const promiseAll: Promise<Grades>[] = []
    const gradesCreation: Grades[] = []

    const errorList: string[] = []
    for (let i = 1; i < data.length; i++) {
      const studentInfo = data[i]

      // Missing information
      if (studentInfo.length !== 2) {
        console.log('Missing information', studentInfo)
        errorList.push(studentInfo[0])
        continue
      }

      const student = await this.studentListRepository.findOne({
        where: {
          studentId: studentInfo[0],
          classroomId: classroomId,
        },
      })
      if (!student) continue
      // ??i???m l???i
      if (!validateGrade(studentInfo[1], gradeStructure)) {
        console.log('Grade is invalid', studentInfo)

        errorList.push(studentInfo[0])
        continue
      }
      const grade = await this.gradesRepository.findOne({
        where: {
          studentListId: student.id,
          name: gradeName,
        },
      })

      if (grade) {
        if (grade.grade !== studentInfo[1]) {
          grade.grade = studentInfo[1]
          promiseAll.push(this.gradesRepository.save(grade))
        }
      } else {
        gradesCreation.push(
          new Grades({
            grade: studentInfo[1],
            name: gradeName,
            studentListId: student.id,
          }),
        )
      }
    }
    if (gradesCreation.length > 0) await this.gradesRepository.createAll(gradesCreation)
    await Promise.all(promiseAll)
    const studentList = await this.studentListRepository.find({
      where: {
        classroomId: classroomId,
      },
      include: ['grades'],
    })

    // Calculate the total
    for (const student of studentList) {
      const total = calculateTotal(student.grades, gradeStructure).toString()

      if (total !== student.total) {
        student.total = total
        await this.studentListRepository.updateById(student.id, { total: student.total })
      }
    }
    return { studentList, errorList }
  }

  /**
   * Get files and fields for the request
   * @param request - Http request
   */
  private static getFilesAndFields(request: Request) {
    const uploadedFiles = request.files
    const mapper = (f: globalThis.Express.Multer.File) => ({
      fieldname: f.fieldname,
      originalname: f.originalname,
      encoding: f.encoding,
      mimetype: f.mimetype,
      size: f.size,
    })
    let files: object[] = []
    if (Array.isArray(uploadedFiles)) {
      files = uploadedFiles.map(mapper)
    } else {
      for (const filename in uploadedFiles) {
        files.push(...uploadedFiles[filename].map(mapper))
      }
    }
    return { files, fields: request.body }
  }

  private mapFileToJson(workbook: XLSX.WorkBook): string[][] {
    const sheets = workbook.SheetNames
    const data: string[][] = []
    for (let i = 0; i < sheets.length; i++) {
      const temp: string[][] = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[i]], {
        raw: false,
        header: 1,
      })
      temp.forEach(te => {
        return data.push(te)
      })
    }

    return data
  }

  async removePreviousStudentList(classroomId: string) {
    const studentList = await this.studentListRepository.find({
      where: {
        classroomId: classroomId,
      },
    })

    await this.gradesRepository.deleteAll({
      studentListId: {
        inq: studentList.map(st => st.id),
      },
    })

    await this.studentListRepository.deleteAll({
      classroomId: classroomId,
    })
  }
}
