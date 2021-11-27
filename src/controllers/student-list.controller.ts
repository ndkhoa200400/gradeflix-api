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
import { StudentList } from '../models'
import {
  ClassroomRepository,
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
    @inject(UserServiceBindings.USER_SERVICE)
    public userService: MyUserService,
    @inject.getter(SecurityBindings.USER, { optional: true })
    private getCurrentUser: Getter<UserProfile>,
    @inject(FILE_UPLOAD_SERVICE) private handler: RequestHandler,
  ) {}

  @intercept(AuthenRoleClassroomInterceptor.BINDING_KEY)
  @post('/classrooms/{id}/student-list')
  @response(200, {
    description: 'Update student list',
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

    const workbook: XLSX.WorkBook = XLSX.read(_.get(body, 'files[0].buffer'), {
      type: 'buffer',
      WTF: true,
    })
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

    /* 
      data là mảng 2 chiều, phần tử là một mảng 2 phần tử gồm mssv và họ tên
      Phần tử đầu là headers
      [
        ['studentId', 'fullName'],
        ['123456', 'hs1']
      ]
    */
    if (data.length > 0) {
      // validate headers
      const headers = data[0]
      if (!headers.includes('studentId') || !headers.includes('fullname'))
        throw new HttpErrors['400']('Định dạng file không đúng. Vui lòng kiểm tra lại.')

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
          await this.studentListRepository.create({
            classroomId: classroomId,
            studentId: studentInfo[0],
            fullName: studentInfo[1],
          })
        } else {
          if (student.fullName !== studentInfo[1])
            await this.studentListRepository.save({ fullName: studentInfo[1] })
        }
      }
    } else {
      throw new HttpErrors['400']('Định dạng file không đúng. Vui lòng kiểm tra lại.')
    }

    const studentList = await this.studentListRepository.find({
      where: {
        classroomId: classroomId,
      },
    })
    return studentList
  }

  @intercept(AuthenRoleClassroomInterceptor.BINDING_KEY)
  @get('/classrooms/{id}/student-list')
  @response(200, {
    description: 'Update student list',
  })
  async changeStudentInfo(
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
}
