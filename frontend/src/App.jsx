import { BrowserRouter, Routes, Route } from 'react-router-dom'
import SiteFooter from './components/SiteFooter.jsx'

import HomePage from './pages/HomePage.jsx'
import SignInPage from './pages/SignInPage.jsx'
import SignUpPage from './pages/SignUpPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'

import AdminDashboard from './pages/admin/AdminDashboard.jsx'
import InstitutionReports from './pages/admin/InstitutionReports.jsx'
import ManageTeachers from './pages/admin/ManageTeachers.jsx'

import StudentRegistrationForm from './pages/student/StudentRegistrationForm.jsx'
import UpdateStudentDetails from './pages/student/UpdateStudentDetails.jsx'
import DemoSession from './pages/student/DemoSession.jsx'
import ViewAttendance from './pages/student/ViewAttendance.jsx'

import TeacherDashboard from './pages/teacher/TeacherDashboard.jsx'
import StartSession from './pages/teacher/StartSession.jsx'
import TeacherUpdateDetails from './pages/teacher/TeacherUpdateDetails.jsx'
import DefaulterList from './pages/attendance/DefaulterList.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <div className="bg-gray-900 text-gray-100 min-h-screen flex flex-col">
        <div className="flex-1">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/signin" element={<SignInPage />} />
            <Route path="/signup" element={<SignUpPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />

            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/reports" element={<InstitutionReports />} />
            <Route path="/admin/teachers" element={<ManageTeachers />} />

            <Route path="/student/registrationform" element={<StudentRegistrationForm />} />
            <Route path="/student/updatedetails" element={<UpdateStudentDetails />} />
            <Route path="/student/demo-session" element={<DemoSession />} />
            <Route path="/student/view-attendance" element={<ViewAttendance />} />

            <Route path="/teacher/dashboard" element={<TeacherDashboard />} />
            <Route path="/teacher/start-session" element={<StartSession />} />
            <Route path="/teacher/updatedetails" element={<TeacherUpdateDetails />} />

            <Route path="/attendance/defaulters" element={<DefaulterList />} />
            <Route path="/defaulter-list" element={<DefaulterList />} />
          </Routes>
        </div>
        <SiteFooter />
      </div>
    </BrowserRouter>
  )
}
