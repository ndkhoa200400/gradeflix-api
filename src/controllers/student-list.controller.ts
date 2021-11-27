import { authenticate } from '@loopback/authentication'
import { UserServiceBindings } from '@loopback/authentication-jwt'
import { Getter, inject, intercept } from '@loopback/core'
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
} from '@loopback/rest'
import { Grades, StudentList } from '../models'
import {
  ClassroomRepository,
  GradesRepository,
  StudentListRepository,
  UserClassroomRepository,
  UserRepository,
} from '../repositories'
import { MyUserService } from '../services'
import { UserProfile, SecurityBindings } from '@loopback/security'
import { AuthenRoleClassroomInterceptor } from '../interceptors'
import { FILE_UPLOAD_SERVICE } from '../keys'
import { RequestHandler } from 'express-serve-static-core'
import _ from 'lodash'
import * as XLSX from 'xlsx'
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
    @inject.getter(SecurityBindings.USER, { optional: true })
    private getCurrentUser: Getter<UserProfile>,
    @inject(FILE_UPLOAD_SERVICE) private handler: RequestHandler,
  ) {}

  @intercept(AuthenRoleClassroomInterceptor.BINDING_KEY)
  @post('/classrooms/{id}/student-list')
  @response(200, {
    description: 'Upload student grades',
  })
  async uploadStudentList(
    @param.path.string('id') classroomId: string,
    @requestBody.file()
    body: Request,
    @inject(RestBindings.Http.RESPONSE) res: Response,
  ): Promise<StudentList[]> {
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
      throw new HttpErrors['400']('Vui lòng chọn một file excel để tiếp tục.')

    const workbook: XLSX.WorkBook = XLSX.read(_.get(body, 'files[0].buffer'), {
      type: 'buffer',
      WTF: true,
    })
    const data = this.mapFileToJson(workbook)

    /* 
      data là mảng 2 chiều, phần tử là một mảng 2 phần tử gồm mssv và họ tên
      Phần tử đầu là headers
      [
        ['studentId', 'fullName'],
        ['123456', 'hs1']
      ]
    */
    if (data.length === 0) {
      throw new HttpErrors['400']('Định dạng file không đúng. Vui lòng kiểm tra lại.')
    }

    // validate headers
    const headers = data[0]
    if (!headers.includes('studentId') || !headers.includes('fullname'))
      throw new HttpErrors['400']('Định dạng file không đúng. Vui lòng kiểm tra lại.')

    const promiseAll: Promise<StudentList>[] = []
    const studentListCreation: StudentList[] = []

    for (let i = 1; i < data.length; i++) {
      const studentInfo = data[i]

      // Missing information
      if (studentInfo.length !== 2) continue

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
    return studentList
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
          schema: { newGrade: 'string' },
        },
      },
    })
    body: { newGrade: 'string' },
  ): Promise<Grades> {
    const studentList = await this.studentListRepository.findOne({
      where: { studentId: studentId, classroomId: classroomId },
    })

    if (!studentList) throw new HttpErrors['404']('Không tìm thấy học sinh.')
    const grade = await this.gradesRepository.findOne({
      where: {
        studentListId: studentList.id,
        name: gradeName,
      },
    })
    if (!grade) throw new HttpErrors['404']('Không tìm thấy điểm của học sinh.')

    this.validateGrade(body.newGrade)

    grade.grade = body.newGrade
    return this.gradesRepository.save(grade)
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
  ): Promise<StudentList[]> {
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
      throw new HttpErrors['400']('Vui lòng chọn một file excel để tiếp tục.')

    const workbook: XLSX.WorkBook = XLSX.read(_.get(body, 'files[0].buffer'), {
      type: 'buffer',
      WTF: true,
    })

    /* 
      data là mảng 2 chiều, phần tử là một mảng 2 phần tử gồm mssv và điểm số
      Phần tử đầu là headers
      [
        ['studentId', 'grades'],
        ['123456', '8']
      ]
    */
    const data = this.mapFileToJson(workbook)

    if (data.length === 0)
      throw new HttpErrors['400']('Định dạng file không đúng. Vui lòng kiểm tra lại.')

    // validate headers
    const headers = data[0]
    if (headers.length !== 2 || !headers.includes('studentId') || !headers.includes('grades'))
      throw new HttpErrors['400']('Định dạng file không đúng. Vui lòng kiểm tra lại.')

    // validate whether gradeName exists in gradeStructure
    const classroom = await this.classroomRepository.findById(classroomId)

    const gradeStructure = classroom.gradeStructure
    if (!gradeStructure) throw new HttpErrors['400']('Vui lòng thêm cấu trúc điểm cho lớp học.')

    const scale = gradeStructure.parems.find(parem => parem.name === gradeName)
    if (!scale) throw new HttpErrors['400'](`Thang điểm ${gradeName} không tồn tại.`)

    // Validate whether classroom has student list or not
    const studentListCount = await this.studentListRepository.count({
      classroomId: classroomId,
    })
    if (studentListCount.count === 0)
      throw new HttpErrors['400']('Vui lòng thêm danh sách lớp học.')

    const promiseAll: Promise<Grades>[] = []
    const gradesCreation: Grades[] = []
    for (let i = 1; i < data.length; i++) {
      const studentInfo = data[i]

      // Missing information
      if (studentInfo.length !== 2) continue

      const student = await this.studentListRepository.findOne({
        where: {
          studentId: studentInfo[0],
          classroomId: classroomId,
        },
      })
      if (!student) continue

      const grade = await this.gradesRepository.findOne({
        where: {
          studentListId: student.id,
          name: gradeName,
        },
      })
      this.validateGrade(studentInfo[1])
      if (grade) {
        if (grade.grade !== studentInfo[1]) {
          grade.grade = studentInfo[1]
          // await this.gradesRepository.save(grade)
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
    return studentList
  }

  @intercept(AuthenRoleClassroomInterceptor.BINDING_KEY)
  @get('/classrooms/{id}/student-list')
  @response(200, {
    description: 'Update student list',
  })
  async find(
    @param.path.string('id') classroomId: string,
    @param.filter(StudentList) filter?: Filter<StudentList>,
  ): Promise<StudentList[]> {
    filter = filter ?? ({} as Filter<StudentList>)

    filter.include = [...(filter.include ?? []), 'grades']
    filter.where = { ...filter.where, classroomId: classroomId }
    const studentList = await this.studentListRepository.find(filter)

    return studentList
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

  private validateGrade(grade: string) {
    const gradeNumber = Number(grade)
    if (!gradeNumber || gradeNumber < 0 || gradeNumber > 10)
      throw new HttpErrors['400']('Điểm không hợp lệ.')
  }

  private mapFileToJson(workbook: XLSX.WorkBook): string[] {
    const sheets = workbook.SheetNames
    const data: string[] = []
    for (let i = 0; i < sheets.length; i++) {
      const temp: string[] = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[i]], {
        raw: false,
        header: 1,
      })
      temp.forEach(te => {
        return data.push(te)
      })
    }

    return data
  }
}
