import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

// Sample data generator
const generateStudentData = (numStudents) => {
  const subjects = ["Math", "Science", "English", "History"];
  const students = [];
  
  for (let i = 0; i < numStudents; i++) {
    const studentTests = [];
    // Generate 20 tests per student
    for (let j = 0; j < 20; j++) {
      const subject = subjects[Math.floor(Math.random() * subjects.length)];
      studentTests.push({
        id: `test-${i}-${j}`,
        subject,
        score: Math.floor(Math.random() * 40) + 60,
        date: new Date(2024, 0, j + 1).toISOString(),
        timeTaken: `00:${Math.floor(Math.random() * 45) + 15}:00`
      });
    }
    
    students.push({
      id: i + 1,
      name: `Student ${i + 1}`,
      grade: `Grade ${Math.floor(Math.random() * 3) + 9}`,
      tests: studentTests,
      attendance: Math.floor(Math.random() * 20) + 80,
      lastActive: new Date(2024, 1, Math.floor(Math.random() * 28) + 1).toISOString()
    });
  }
  return students;
};

const TeacherDashboard = () => {
  const [selectedStudent, setSelectedStudent] = useState('all');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [timeRange, setTimeRange] = useState('all');
  
  // Generate sample data
  const students = useMemo(() => generateStudentData(10), []);
  
  // Filter and process data based on selections
  const filteredData = useMemo(() => {
    let data = students.flatMap(student => 
      student.tests.map(test => ({
        ...test,
        studentName: student.name,
        studentId: student.id
      }))
    );
    
    if (selectedStudent !== 'all') {
      data = data.filter(item => item.studentId === parseInt(selectedStudent));
    }
    
    if (selectedSubject !== 'all') {
      data = data.filter(item => item.subject === selectedSubject);
    }
    
    if (timeRange !== 'all') {
      const now = new Date();
      const threshold = new Date();
      threshold.setDate(now.getDate() - parseInt(timeRange));
      data = data.filter(item => new Date(item.date) >= threshold);
    }
    
    return data;
  }, [students, selectedStudent, selectedSubject, timeRange]);

  // Calculate analytics
  const analytics = useMemo(() => {
    const totalTests = filteredData.length;
    const avgScore = totalTests > 0 
      ? Math.round(filteredData.reduce((acc, test) => acc + test.score, 0) / totalTests) 
      : 0;
    
    // Subject-wise performance
    const subjectPerformance = filteredData.reduce((acc, test) => {
      if (!acc[test.subject]) {
        acc[test.subject] = { total: 0, count: 0 };
      }
      acc[test.subject].total += test.score;
      acc[test.subject].count += 1;
      return acc;
    }, {});
    
    const subjectData = Object.entries(subjectPerformance).map(([subject, data]) => ({
      subject,
      average: Math.round(data.total / data.count)
    }));
    
    // Time-series data
    const timeSeriesData = filteredData.reduce((acc, test) => {
      const date = new Date(test.date).toLocaleDateString();
      if (!acc[date]) {
        acc[date] = { date, average: 0, count: 0 };
      }
      acc[date].average += test.score;
      acc[date].count += 1;
      return acc;
    }, {});
    
    const performanceTrend = Object.values(timeSeriesData).map(item => ({
      date: item.date,
      average: Math.round(item.average / item.count)
    }));
    
    return {
      totalTests,
      avgScore,
      subjectData,
      performanceTrend
    };
  }, [filteredData]);

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold mb-4">Teacher Analytics Dashboard</h1>
      
      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <select 
          className="p-2 border rounded"
          value={selectedStudent}
          onChange={(e) => setSelectedStudent(e.target.value)}
        >
          <option value="all">All Students</option>
          {students.map(student => (
            <option key={student.id} value={student.id}>
              {student.name}
            </option>
          ))}
        </select>
        
        <select
          className="p-2 border rounded"
          value={selectedSubject}
          onChange={(e) => setSelectedSubject(e.target.value)}
        >
          <option value="all">All Subjects</option>
          <option value="Math">Math</option>
          <option value="Science">Science</option>
          <option value="English">English</option>
          <option value="History">History</option>
        </select>
        
        <select
          className="p-2 border rounded"
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
        >
          <option value="all">All Time</option>
          <option value="7">Last 7 Days</option>
          <option value="30">Last 30 Days</option>
          <option value="90">Last 90 Days</option>
        </select>
      </div>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Total Tests</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{analytics.totalTests}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Average Score</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{analytics.avgScore}%</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Active Students</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {students.filter(s => new Date(s.lastActive) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="students">Students</TabsTrigger>
          <TabsTrigger value="subjects">Subjects</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>Performance Trend</CardTitle>
            </CardHeader>
            <CardContent className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics.performanceTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="average" stroke="#8884d8" name="Average Score" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="subjects">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Subject Performance</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.subjectData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="subject" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="average" fill="#82ca9d" name="Average Score" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Recent Tests</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="p-2 text-left">Student</th>
                        <th className="p-2 text-left">Subject</th>
                        <th className="p-2 text-left">Score</th>
                        <th className="p-2 text-left">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredData.slice(0, 5).map((test) => (
                        <tr key={test.id} className="border-b">
                          <td className="p-2">{test.studentName}</td>
                          <td className="p-2">{test.subject}</td>
                          <td className="p-2">{test.score}%</td>
                          <td className="p-2">{new Date(test.date).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="students">
          <div className="grid grid-cols-1 gap-4">
            {students.map(student => (
              <Card key={student.id}>
                <CardHeader>
                  <CardTitle>{student.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Grade</p>
                      <p className="font-bold">{student.grade}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Attendance</p>
                      <p className="font-bold">{student.attendance}%</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Average Score</p>
                      <p className="font-bold">
                        {Math.round(student.tests.reduce((acc, test) => acc + test.score, 0) / student.tests.length)}%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TeacherDashboard;