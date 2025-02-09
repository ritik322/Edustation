import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, getDocs, doc, getDoc, where } from 'firebase/firestore';
import { db } from '../firebase-config';

import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const TeacherDashboard = ({currentUser}) => {
  const [userRole, setUserRole] = useState(null);
  const [quizAttempts, setQuizAttempts] = useState([]);
  const [documents, setDocuments] = useState({});
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedStudent, setSelectedStudent] = useState('all');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [timeRange, setTimeRange] = useState('all');

  // Check if the current user is logged in and has admin privileges
  useEffect(() => {
    const checkUserRole = async () => {
      if (!currentUser?.uid) {
        setError("Please log in to access the dashboard");
        setLoading(false);
        return;
      }

      try {
        const userRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
          setError("User profile not found");
          setLoading(false);
          return;
        }

        const userData = userSnap.data();
        setUserRole(userData.role);

        if (userData.role !== 'admin') {
          setError("Access denied. Admin privileges required.");
          setLoading(false);
          return;
        }
      } catch (error) {
        console.error("Error checking user role:", error);
        setError("Failed to verify user permissions");
        setLoading(false);
      }
    };

    checkUserRole();
  }, [currentUser]);

  // Fetch all quiz attempts only if the user is verified as an admin
  useEffect(() => {
    const fetchQuizAttempts = async () => {
      if (userRole !== 'admin') return;

      try {
        console.log(1)
        const q = query(collection(db, "quizAttempts"));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
          setQuizAttempts([]);
          setLoading(false);
          return;
        }

        const attempts = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          submittedAt: doc.data().submittedAt,
        }));

        setQuizAttempts(attempts);
        setError(null);
      } catch (error) {
        console.error("Error fetching quiz attempts:", error);
        setError(
          error.code === 'permission-denied'
            ? "You don't have permission to access this data."
            : "Failed to load quiz attempts. Please try again later."
        );
      }
    };

    if (userRole === 'admin') {
      fetchQuizAttempts();
    }
  }, [userRole]);

  // Fetch document details for each quiz attempt
  useEffect(() => {
    const fetchDocuments = async () => {
      console.log(2)
      const docIds = Array.from(new Set(quizAttempts.map((attempt) => attempt.documentId)));
      const docsData = {};

      await Promise.all(
        docIds.map(async (docId) => {
          try {
            const docRef = doc(db, "documents", docId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
              docsData[docId] = docSnap.data();
            }
          } catch (error) {
            console.error(`Error fetching document with id ${docId}:`, error);
          }
        })
      );

      setDocuments(docsData);
    };

    if (quizAttempts.length > 0) {
      fetchDocuments();
    }
  }, [quizAttempts]);

  // Fetch student details for each quiz attempt
  useEffect(() => {
    console.log(3)
    const fetchStudents = async () => {
      const studentIds = Array.from(new Set(quizAttempts.map(attempt => attempt.userId)));
      const studentsData = [];

      await Promise.all(
        studentIds.map(async (studentId) => {
          try {
            const userRef = doc(db, "users", studentId);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
              const userData = userSnap.data();
              const studentAttempts = quizAttempts.filter(attempt => attempt.userId === studentId);
              
              studentsData.push({
                id: studentId,
                name: userData.name || `Student ${studentId}`,
                grade: userData.grade || 'N/A',
                tests: studentAttempts,
                attendance: userData.attendance || 0,
                lastActive: studentAttempts.length > 0 
                  ? Math.max(...studentAttempts.map(a => new Date(a.submittedAt).getTime()))
                  : null
              });
            }
          } catch (error) {
            console.error(`Error fetching user with id ${studentId}:`, error);
          }
        })
      );

      setStudents(studentsData);
      setLoading(false);
    };

    if (quizAttempts.length > 0) {
      fetchStudents();
    }
  }, [quizAttempts]);

  // Filter and process data based on selections
  const filteredData = useMemo(() => {
    let data = quizAttempts.map(attempt => ({
      ...attempt,
      studentName: students.find(s => s.id === attempt.userId)?.name || 'Unknown Student',
      subject: documents[attempt.documentId]?.subject || 'Unknown Subject'
    }));
    
    if (selectedStudent !== 'all') {
      data = data.filter(item => item.userId === selectedStudent);
    }
    
    if (selectedSubject !== 'all') {
      data = data.filter(item => documents[item.documentId]?.subject === selectedSubject);
    }
    
    if (timeRange !== 'all') {
      const now = new Date();
      const threshold = new Date();
      threshold.setDate(now.getDate() - parseInt(timeRange));
      data = data.filter(item => new Date(item.submittedAt) >= threshold);
    }
    
    return data;
  }, [quizAttempts, students, documents, selectedStudent, selectedSubject, timeRange]);

  // Calculate analytics
  const analytics = useMemo(() => {
    const totalTests = filteredData.length;
    const avgScore = totalTests > 0 
      ? Math.round(filteredData.reduce((acc, test) => acc + test.score, 0) / totalTests) 
      : 0;
    
    // Subject-wise performance
    const subjectPerformance = filteredData.reduce((acc, test) => {
      const subject = documents[test.documentId]?.subject || 'Unknown';
      if (!acc[subject]) {
        acc[subject] = { total: 0, count: 0 };
      }
      acc[subject].total += test.score;
      acc[subject].count += 1;
      return acc;
    }, {});
    
    const subjectData = Object.entries(subjectPerformance).map(([subject, data]) => ({
      subject,
      average: Math.round(data.total / data.count)
    }));
    
    // Time-series data
    const timeSeriesData = filteredData.reduce((acc, test) => {
      const date = new Date(test.submittedAt).toLocaleDateString();
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
  }, [filteredData, documents]);

  // If no user is logged in
  if (!currentUser) {
    return (
      <div className="p-4">
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
          Please log in to access the admin dashboard.
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold mb-4">Admin Analytics Dashboard</h1>
      
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
          {Array.from(new Set(Object.values(documents).map(doc => doc.subject)))
            .filter(Boolean)
            .map(subject => (
              <option key={subject} value={subject}>{subject}</option>
            ))
          }
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
              {students.filter(s => s.lastActive && 
                new Date(s.lastActive) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length}
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
                          <td className="p-2">{documents[test.documentId]?.subject || 'Unknown'}</td>
                          <td className="p-2">{test.score}%</td>
                          <td className="p-2">{new Date(test.submittedAt).toLocaleDateString()}</td>
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
                      <p className="text-sm text-gray-500">Last Active</p>
                      <p className="font-bold">
                        {student.lastActive 
                          ? new Date(student.lastActive).toLocaleDateString()
                          : 'Never'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Average Score</p>
                      <p className="font-bold">
                        {student.tests.length > 0
                          ? Math.round(student.tests.reduce((acc, test) => acc + test.score, 0) / student.tests.length)
                          : 'N/A'}%
                      </p>
                    </div>
                  </div>

                  {/* Student's Performance Chart */}
                  <div className="mt-4 h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={student.tests.sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt))}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="submittedAt" 
                          tickFormatter={(date) => new Date(date).toLocaleDateString()}
                        />
                        <YAxis domain={[0, 100]} />
                        <Tooltip 
                          labelFormatter={(label) => new Date(label).toLocaleDateString()}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="score" 
                          stroke="#8884d8" 
                          name="Score" 
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Recent Activity */}
                  <div className="mt-4">
                    <h3 className="font-semibold mb-2">Recent Activity</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="p-2 text-left">Subject</th>
                            <th className="p-2 text-left">Score</th>
                            <th className="p-2 text-left">Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {student.tests
                            .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
                            .slice(0, 3)
                            .map((test) => (
                              <tr key={test.id} className="border-b">
                                <td className="p-2">{documents[test.documentId]?.subject || 'Unknown'}</td>
                                <td className="p-2">{test.score}%</td>
                                <td className="p-2">{new Date(test.submittedAt).toLocaleDateString()}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
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
