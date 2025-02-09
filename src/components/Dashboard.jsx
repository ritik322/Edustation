import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase-config';
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

const calculateStreak = (attempts) => {
  if (!attempts?.length) return 0;
  
  const sortedAttempts = [...attempts].sort(
    (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
  );
  
  let streak = 1;
  let currentDate = new Date(sortedAttempts[0].submittedAt);
  
  for (let i = 1; i < sortedAttempts.length; i++) {
    const prevDate = new Date(currentDate);
    prevDate.setDate(prevDate.getDate() - 1);
    
    if (new Date(sortedAttempts[i].submittedAt).toDateString() === prevDate.toDateString()) {
      streak++;
      currentDate = new Date(sortedAttempts[i].submittedAt);
    } else {
      break;
    }
  }
  
  return streak;
};

const StudentDashboard = ({ userId }) => {
  const [quizAttempts, setQuizAttempts] = useState([]);
  const [documents, setDocuments] = useState({}); // to store documents data keyed by documentId
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch quiz attempts
  useEffect(() => {
    const fetchQuizAttempts = async () => {
      if (!userId) {
        setError("No user ID provided");
        setLoading(false);
        return;
      }

      try {
        const q = query(
          collection(db, "quizAttempts"),
          where("userId", "==", userId)
        );
        
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
            ? "You don't have permission to access this data. Please check your authentication status."
            : "Failed to load quiz attempts. Please try again later."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchQuizAttempts();
  }, [userId]);

  // Fetch document details (to get the subject) for each quiz attempt
  useEffect(() => {
    const fetchDocuments = async () => {
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

  // Calculate document averages using quizAttempts
  const documentAverages = quizAttempts.reduce((acc, attempt) => {
    if (!acc[attempt.documentId]) {
      acc[attempt.documentId] = { total: 0, count: 0 };
    }
    acc[attempt.documentId].total += attempt.score;
    acc[attempt.documentId].count += 1;
    return acc;
  }, {});

  // Map the averages to use document's subject (fallback to documentId if not found)
  const documentData = Object.entries(documentAverages).map(([docId, data]) => ({
    document: documents[docId]?.subject || docId,
    average: Math.round(data.total / data.count),
  }));

  // Calculate monthly averages for quiz attempts
  const monthlyData = quizAttempts.reduce((acc, attempt) => {
    const date = new Date(attempt.submittedAt);
    const month = date.toLocaleString('default', { month: 'short' });
    if (!acc[month]) {
      acc[month] = { total: 0, count: 0 };
    }
    acc[month].total += attempt.score;
    acc[month].count += 1;
    return acc;
  }, {});

  const monthlyAverages = Object.entries(monthlyData).map(([month, data]) => ({
    month,
    average: Math.round(data.total / data.count),
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold mb-4">Student Analytics Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Current Streak</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {calculateStreak(quizAttempts)} days
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Average Score</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {Math.round(
                quizAttempts.reduce((acc, attempt) => acc + attempt.score, 0) /
                quizAttempts.length
              )}%
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Quizzes Taken</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{quizAttempts.length}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="performance">
        <TabsList>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="history">Quiz History</TabsTrigger>
        </TabsList>
        
        <TabsContent value="performance">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Document Performance</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={documentData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="document" />
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
              <CardTitle>Recent Quiz Attempts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="p-2 text-left">Date</th>
                      <th className="p-2 text-left">Document</th>
                      <th className="p-2 text-left">Score</th>
                      <th className="p-2 text-left">Correct Answers</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quizAttempts
                      .sort(
                        (a, b) =>
                          new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
                      )
                      .slice(0, 10)
                      .map((attempt) => (
                        <tr key={attempt.id} className="border-b">
                          <td className="p-2">
                            {new Date(attempt.submittedAt).toLocaleDateString()}
                          </td>
                          <td className="p-2">
                            {documents[attempt.documentId]?.subject || attempt.documentId}
                          </td>
                          <td className="p-2">{attempt.score}%</td>
                          <td className="p-2">
                            {Object.values(attempt.answerResults || {}).filter(r => r.isCorrect)
                              .length}{' '}
                            / {Object.keys(attempt.answerResults || {}).length}
                          </td>
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

export default StudentDashboard;
