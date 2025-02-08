// components/Dashboard.jsx
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

// Sample data and component implementation remains the same as previous example
const generateTestData = () => {
  const subjects = ["Math", "Science", "English", "History"];
  const tests = [];
  
  for (let i = 0; i < 50; i++) {
    tests.push({
      testId: i + 1,
      userId: 1,
      subject: subjects[Math.floor(Math.random() * subjects.length)],
      score: Math.floor(Math.random() * 40) + 60, // Scores between 60-100
      totalMarks: 100,
      timeTaken: "00:" + (Math.floor(Math.random() * 45) + 15) + ":00",
      timestamp: new Date(2024, 0, i + 1).toISOString()
    });
  }
  return tests;
};

const sampleData = {
  students: [
    {
      id: 1,
      username: "john_doe",
      email: "john@example.com",
      class: "10",
      subjects: ["Math", "Science", "English"],
      currentStreak: 5,
      lastTestDate: "2024-02-08",
      institute: "ABC School",
      location: "New York"
    }
  ],
  tests: generateTestData(),
  teachers: [
    {
      id: 1,
      name: "Ms. Smith",
      subjects: ["Math"],
      students: [1],
      location: "New York",
      institute: "ABC School"
    }
  ]
};

const Dashboard = () => {
  const testData = sampleData.tests;
  
  // Calculate subject-wise averages
  const subjectAverages = testData.reduce((acc, test) => {
    if (!acc[test.subject]) {
      acc[test.subject] = { total: 0, count: 0 };
    }
    acc[test.subject].total += test.score;
    acc[test.subject].count += 1;
    return acc;
  }, {});

  const subjectData = Object.entries(subjectAverages).map(([subject, data]) => ({
    subject,
    average: Math.round(data.total / data.count)
  }));

  // Calculate monthly averages
  const monthlyData = testData.reduce((acc, test) => {
    const month = new Date(test.timestamp).toLocaleString('default', { month: 'short' });
    if (!acc[month]) {
      acc[month] = { total: 0, count: 0 };
    }
    acc[month].total += test.score;
    acc[month].count += 1;
    return acc;
  }, {});

  const monthlyAverages = Object.entries(monthlyData).map(([month, data]) => ({
    month,
    average: Math.round(data.total / data.count)
  }));

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold mb-4">Student Analytics Dashboard</h1>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Current Streak</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{sampleData.students[0].currentStreak} days</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Average Score</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {Math.round(testData.reduce((acc, test) => acc + test.score, 0) / testData.length)}%
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Tests Taken</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{testData.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Tables */}
      <Tabs defaultValue="performance">
        <TabsList>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="history">Test History</TabsTrigger>
        </TabsList>
        
        <TabsContent value="performance">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Subject-wise Performance</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={subjectData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="subject" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="average" fill="#8884d8" name="Average Score" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Monthly Progress</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyAverages}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="average" fill="#82ca9d" name="Average Score" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Recent Tests</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="p-2 text-left">Date</th>
                      <th className="p-2 text-left">Subject</th>
                      <th className="p-2 text-left">Score</th>
                      <th className="p-2 text-left">Time Taken</th>
                    </tr>
                  </thead>
                  <tbody>
                    {testData.slice(0, 10).map((test) => (
                      <tr key={test.testId} className="border-b">
                        <td className="p-2">
                          {new Date(test.timestamp).toLocaleDateString()}
                        </td>
                        <td className="p-2">{test.subject}</td>
                        <td className="p-2">{test.score}%</td>
                        <td className="p-2">{test.timeTaken}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Dashboard;