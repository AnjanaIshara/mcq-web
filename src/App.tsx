import { useEffect, useMemo, useState } from 'react';
import { clampExpectedSelections, toggleSelection } from './logic';
import { Option, Question } from './types';

const defaultXml = `
<questions>
	<question id="q1" title="Capital of France" expectedSelections="1">
		<prompt>What is the capital of France?</prompt>
		<option label="A">Paris</option>
		<option label="B">Berlin</option>
		<option label="C">Madrid</option>
		<option label="D">Rome</option>
		<answer>A</answer>
	</question>
	<question id="q2" title="Prime numbers (pick 2)" expectedSelections="2">
		<prompt>Which two of these are prime numbers?</prompt>
		<option label="A">2</option>
		<option label="B">4</option>
		<option label="C">5</option>
		<option label="D">9</option>
		<option label="E">11</option>
		<answer>A</answer>
		<answer>C</answer>
	</question>
	<question id="q3" title="Colors in the flag (pick 3)" expectedSelections="3">
		<prompt>Select the three colors in the Irish flag.</prompt>
		<option label="A">Green</option>
		<option label="B">Orange</option>
		<option label="C">Blue</option>
		<option label="D">White</option>
		<option label="E">Red</option>
		<option label="F">Yellow</option>
		<answer>A</answer>
		<answer>B</answer>
		<answer>D</answer>
	</question>
</questions>`;

type XmlQuestion = Question & {id: string; title: string };

type QuizSource = { 
    id: string; 
    name: string; 
    description: string; 
    type: 'inline' | 'url'; 
    xml?: string; 
    url?: string; 
}; 

const quizSources: 
QuizSource[] = [ { 
        id: 'default', 
        name: 'Built-in sample quiz', 
        description: 'Geography, primes, and flags.', 
        type: 'inline', 
        xml: defaultXml 
    }, 
    { 
        id: 'math-basics', 
        name: 'Math basics', 
        description: 'Simple math and shapes.', 
        type: 'url', 
        url: '/quizzes/math-basics.xml' 
    } 
];

declare global {
    interface Window {
        setMcqXml?: (xml:string) => void;
    }
}

function parseQuestionsFromXml(xml: string): XmlQuestion[] { 
    try { 
        const parser = new DOMParser(); 
        const doc = parser.parseFromString(xml, 'application/xml'); 
        const nodes = Array.from(doc.querySelectorAll('question'));
        const questions = nodes.map((node, idx): XmlQuestion => { 
            const id = node.getAttribute('id') ?? `q-${idx}`;
            const title = node.getAttribute('title') ?? `Question ${idx + 1}`;
            const expectedSelections = clampExpectedSelections([], Number(node.getAttribute('expectedSelections')) || 1);
            const promptText = node.querySelector('prompt')?.textContent?.trim() || node.getAttribute('prompt') || title;
            const options: Option[] = Array.from(node.querySelectorAll('option')).map((opt, optIdx) => { 
                const label = opt.getAttribute('label') ?? String.fromCharCode(65 + optIdx);
                return { 
                    id: `opt-${label.toLowerCase()}`, 
                    text: opt.textContent?.trim() || `Option ${label}` 
                };
     });
         const answers = Array.from(node.querySelectorAll('answer')).map((ans) => ans.textContent?.trim() || '').filter(Boolean);
         const correctOptionIds = answers
            .map((label) => label.trim()) 
            .map((label) => `opt-${label.toLowerCase()}`) 
            .filter((id) => options.some((opt) => opt.id === id));
         const safeExpected = clampExpectedSelections(options, expectedSelections);
         return { 
            id, 
            title, 
            prompt: promptText, 
            expectedSelections: safeExpected, 
            options, correctOptionIds };
        });
        return questions.length ? questions : fallbackQuestions();
     } catch (err) { 
            console.error('Failed to parse XML questions', err);
            return fallbackQuestions();
         } 
}

function fallbackQuestions(): XmlQuestion[] { 
    return [ 
        { 
            id: 'fallback-1', 
            title: 'Sample question', 
            prompt: 'Sample prompt from fallback.', 
            expectedSelections: 1, 
            options: [ 
                { id: 'opt-a', text: 'Option A' }, 
                { id: 'opt-b', text: 'Option B' }, 
                { id: 'opt-c', text: 'Option C' }, 
                { id: 'opt-d', text: 'Option D' } 
            ], correctOptionIds: ['opt-a'] 
        } 
    ]; 
} 
export default function App() {
    const [xmlText, setXmlText] = useState<string>(defaultXml); 
    const xmlQuestions = useMemo(() => parseQuestionsFromXml(xmlText), [xmlText]); 
    
    const [availableSources, setAvailableSources] = useState<QuizSource[]>([quizSources[0]]); 
    const [selectedQuizId, setSelectedQuizId] = useState<string>(quizSources[0].id); 
    const [hasStarted, setHasStarted] = useState<boolean>(false); 
    const [loadingQuiz, setLoadingQuiz] = useState<boolean>(false); 
    const [loadError, setLoadError] = useState<string | null>(null); 
    const [activeQuizTitle, setActiveQuizTitle] = useState<string>(quizSources[0].name);

    const [questions, setQuestions] = useState<XmlQuestion[]>(xmlQuestions); 
    const [currentIndex, setCurrentIndex] = useState<number>(0); 
    const [selections, setSelections] = useState<Record<string, string[]>>({}); 
    const [results, setResults] = useState<Record<string, { correctCount: number; total: number }>>({}); 
    const [finalScore, setFinalScore] = useState<{ correct: number; total: number } | null>(null); 
    
    const currentQuestion = questions[currentIndex]; 
    const selectedOptionIds = currentQuestion ? selections[currentQuestion.id] ?? [] : []; 
    
    const atSelectionLimit = useMemo(() => { 
        if (!currentQuestion) return false; 
        return currentQuestion.expectedSelections > 1 && selectedOptionIds.length >= currentQuestion.expectedSelections; 
    }, [selectedOptionIds.length, currentQuestion]); 
    
    useEffect(() => { 
        if (!xmlQuestions.length) return; 
        setQuestions(xmlQuestions); 
        setCurrentIndex(0); 
        setSelections({}); 
        setResults({}); 
        setFinalScore(null); 
    }, [xmlQuestions]); 
    
    useEffect(() => { 
        let cancelled = false; 
        const load = async () => { 
            const found: QuizSource[] = [quizSources[0]]; 
            for (const src of quizSources.slice(1)) { 
                if (src.type === 'url' && src.url) { 
                    try { 
                        const res = await fetch(src.url); 
                        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`); 
                        const text = await res.text(); 
                        const parsed = parseQuestionsFromXml(text); 
                        if (parsed.length && !cancelled) { 
                            found.push(src); 
                        } 
                    } catch (err) { 
                        console.error('Skipping quiz source', src.id, err); 
                    } 
                } 
            } 
            if (!cancelled) { 
                setAvailableSources(found); 
            } 
        }; 
        load(); 
        return () => { 
            cancelled = true; 
        }; 
    }, []);

    useEffect(() => { 
        const params = new URLSearchParams(window.location.search); 
        const xmlUrl = params.get('xmlUrl'); 
        if (xmlUrl) { 
            fetch(xmlUrl) 
            .then((res) => res.text()) 
            .then((text) => {
                const parsed = parseQuestionsFromXml(text);
                if (parsed.length) {
                    setXmlText(text);
                    setActiveQuizTitle('Custom URL');
                    setHasStarted(true);
                }
            }) 
            .catch((err) => console.error('Failed to fetch xmlUrl', err)); 
        } 
        window.setMcqXml = (xml: string) => {
            const parsed = parseQuestionsFromXml(xml);
            if (parsed.length) {
                setXmlText(xml);
                setActiveQuizTitle('Custom XML');
                setHasStarted(true);
            }
        }; 
        return () => { 
            window.setMcqXml = undefined; 
        }; 
    }, []);
    
    const handlePromptChange = (value: string) => { 
        setFinalScore(null); 
        setResults((prev) => { 
            if (!currentQuestion) return prev; 
            const next = { ...prev }; 
            delete next[currentQuestion.id]; 
            return next; 
        }); 
        setQuestions((prev) => 
            prev.map((q, idx) => (idx === currentIndex ? { ...q, prompt: value } : q)) 
        ); 
    }; 

    const handlePresetChange = (presetId: string) => { 
        const targetIndex = questions.findIndex((q) => q.id === presetId); 
        if (targetIndex >= 0) { 
            setCurrentIndex(targetIndex); 
        } 
    }; 
    
    const handleXmlFile = async (file: File | null) => { 
        if (!file) return; 
        try { 
            const text = await file.text(); 
            setXmlText(text); 
            setFinalScore(null); 
            setActiveQuizTitle(file.name);
            setHasStarted(true);
        } catch (err) { 
            console.error('Failed to read XML file', err); 
        } 
    }; 
    const handleExpectedChange = (value: number) => { 
        const bounded = Math.max(1, Number.isFinite(value) ? value : 1); 
        if (!currentQuestion) return; 
        const nextExpected = clampExpectedSelections(currentQuestion.options, bounded); 
        setSelections((prev) => { 
            const current = prev[currentQuestion.id] ?? []; 
            return { ...prev, [currentQuestion.id]: current.slice(0, nextExpected) }; 
        }); 
        setResults((prev) => { 
            const next = { ...prev }; 
            delete next[currentQuestion.id]; 
            return next; 
        }); 
        setFinalScore(null); 
        setQuestions((prev) => 
            prev.map((q, idx) => (idx === currentIndex ? { ...q, expectedSelections: nextExpected } : q)) 
        ); 
    }; 
    const handleOptionTextChange = (optionId: string, text: string) => { 
        setFinalScore(null); 
        setResults((prev) => { 
            const next = { ...prev }; 
            if (currentQuestion) delete next[currentQuestion.id]; 
            return next; 
        }); 
        setQuestions((prev) => 
            prev.map((q, idx) => 
                idx === currentIndex ? { ...q, options: q.options.map((opt) => (opt.id === optionId ? { ...opt, text } : opt)) } : q 
            )
        ); 
    }; 
    
    const handleSelectOption = (optionId: string) => { 
        if (!currentQuestion) return; 
        setFinalScore(null); 
        setResults((prev) => { 
            const next = { ...prev }; 
            delete next[currentQuestion.id]; 
            return next; 
        }); 
        
        setSelections((prev) => { 
            const current = prev[currentQuestion.id] ?? []; 
            if (currentQuestion.expectedSelections === 1) { 
                return { ...prev, [currentQuestion.id]: [optionId] }; 
            } 
            const next = toggleSelection(current, optionId, currentQuestion.expectedSelections); 
            return { ...prev, [currentQuestion.id]: next };
        }); 
    }; 
    
    const handleCheckAnswers = () => { 
        if (!currentQuestion) return;
        const correctIds = currentQuestion.correctOptionIds; 
        const picks = selections[currentQuestion.id] ?? []; 
        const isCorrect = correctIds.length === picks.length && correctIds.every((id) => picks.includes(id)); 
        setResults((prev) => ({ ...prev, [currentQuestion.id]: { correctCount: isCorrect ? 1 : 0, total: 1 } })); 
        setFinalScore(null); 
    }; 

    const startQuiz = async (quizId?: string) => { 
        const targetId = quizId ?? selectedQuizId; 
        const source = availableSources.find((s) => s.id === targetId) ?? availableSources[0]; 
        if (!source) { 
            setLoadError('No quiz available to start.'); 
            return; 
        } 
        setLoadingQuiz(true); 
        setLoadError(null); 
        try { let xml = source.xml ?? ''; 
            if (source.type === 'url' && source.url) { 
                const res = await fetch(source.url); 
                if (!res.ok) throw new Error(`Fetch failed (${res.status})`); 
                xml = await res.text(); 
            } 
            const parsed = parseQuestionsFromXml(xml); 
            if (!parsed.length) throw new Error('No questions found in XML.'); 
            setXmlText(xml); 
            setActiveQuizTitle(source.name); 
            setSelectedQuizId(source.id); 
            setHasStarted(true); 
        } catch (err) { 
            console.error('Failed to start quiz', err); 
            setLoadError('Failed to load the selected quiz.'); 
        } finally { 
            setLoadingQuiz(false); 
        } 
    };
    
    const handleNext = () => { 
        if (currentIndex < questions.length - 1) { 
            setCurrentIndex((idx) => idx + 1); 
        } 
    }; 
    
    const handleBack = () => { 
        if (currentIndex > 0) {
            setCurrentIndex((idx) => idx - 1); 
        } 
    }; 
    
    const handleFinishQuiz = () => { 
        let correct = 0; 
        questions.forEach((q) => { 
            const picks = selections[q.id] ?? []; 
            const isCorrect = q.correctOptionIds.length === picks.length && q.correctOptionIds.every((id) => picks.includes(id)); 
            if (isCorrect) correct += 1;
        }); 
        setFinalScore({ correct, total: questions.length }); 
        window.scrollTo({ top: 0, behavior: 'smooth' }); 
    }; 

    if (!hasStarted) { 
        return ( 
            <div className="page">
            <header className="hero">
                <div>
                <p className="eyebrow">MCQ Builder</p>
                <h1>Select a quiz to start</h1>
                <p className="lede">Choose from built-in samples or your own XML file.</p>
                </div>
            </header>
            <section className="card">
                <div className="section-head">
                <h2>Available quizzes</h2>
                </div> {loadError && <p className="error-text">{loadError}</p>} <div className="quiz-list"> {availableSources.map((quiz) => ( <label
  key={quiz.id}
  className={`quiz-card ${selectedQuizId === quiz.id ? 'selected' : ''}`}
>
                    <input type="radio" name="quiz-source" value={quiz.id} checked={selectedQuizId===quiz.id} onChange={()=> setSelectedQuizId(quiz.id)} /> <div>
                    <p className="quiz-title">{quiz.name}</p>
                    <p className="quiz-desc">{quiz.description}</p>
                    <span className="pill neutral">{quiz.type === 'inline' ? 'Built-in' : 'From file'}</span>
                    </div>
                </label> ))} </div>
                <div className="actions">
                <button type="button" className="ghost" onClick={()=> startQuiz()} disabled={loadingQuiz}> {loadingQuiz ? 'Loading…' : 'Start quiz'} </button>
                <span className="pill neutral">or load an XML file below</span>
                </div>
                <label className="field" style={{ marginTop: '16px' }}>
                <span>Load questions from XML file (optional)</span>
                <input type="file" accept=".xml,text/xml" onChange={(e)=> handleXmlFile(e.target.files?.[0] ?? null)} /> <small>Replace the built-in sample XML by choosing a file.</small>
                </label>
            </section>
            </div>
        ); 
    }
    return ( 
        
        <div className="page">
  <header className="hero">
    <div>
      <p className="eyebrow">MCQ Builder</p>
      <h1>{activeQuizTitle}</h1>
      <p className="lede">Switch between single and multi-answer modes without losing clarity.</p>
    </div>
  </header>

  <main className="grid">
    <section className="card preview">
      <div className="section-head">
        <h2>Preview</h2>
        <span className="pill neutral">Live</span>
      </div>

      <div className="nav-row">
        <button
          type="button"
          className="ghost"
          onClick={handleBack}
          disabled={currentIndex === 0 || !questions.length}
        >
          ← Back
        </button>
        <span className="pill neutral">
          Question {questions.length ? currentIndex + 1 : 0} of {questions.length || 0}
        </span>
        <button
          type="button"
          className="ghost"
          onClick={handleNext}
          disabled={currentIndex >= questions.length - 1}
        >
          Next →
        </button>
      </div>

      <div className="question-block">
        <p className="question-text">
          {currentQuestion?.prompt || 'Your question will appear here.'}
        </p>
        <p className="hint">
          Select up to {currentQuestion?.expectedSelections ?? 1} answer(s).
        </p>
      </div>

      <div className="choices">
        {currentQuestion?.options.map((opt) => {
          const selected = selectedOptionIds.includes(opt.id);
          const inputType = currentQuestion.expectedSelections === 1 ? 'radio' : 'checkbox';
          const limitReached = atSelectionLimit && !selected;

          return (
            <label
              key={opt.id}
              className={['choice', selected && 'active', limitReached && 'disabled']
                .filter(Boolean)
                .join(' ')}
            >
              <input
                type={inputType}
                name="choice"
                checked={selected}
                disabled={limitReached}
                onChange={() => handleSelectOption(opt.id)}
              />
              <span className="choice-text">{opt.text}</span>
            </label>
          );
        })}
      </div>

      {atSelectionLimit && currentQuestion && currentQuestion.expectedSelections > 1 && (
        <p className="limit-note">Reached the selection limit for this question.</p>
      )}

      <div className="actions">
        <button
          type="button"
          className="ghost"
          onClick={handleCheckAnswers}
          disabled={!currentQuestion || !currentQuestion.correctOptionIds.length}
        >
          Check answers
        </button>

        {currentQuestion && results[currentQuestion.id] && (
          <span
            className={`pill ${
              results[currentQuestion.id].correctCount === results[currentQuestion.id].total
                ? ''
                : 'neutral'
            }`}
          >
            You got {results[currentQuestion.id].correctCount} /{' '}
            {results[currentQuestion.id].total} correct.
          </span>
        )}
      </div>

      <div className="actions">
        <button
          type="button"
          className="ghost"
          onClick={handleFinishQuiz}
          disabled={!questions.length}
        >
          Finish quiz
        </button>

        {finalScore && (
          <span
            className={`pill ${finalScore.correct === finalScore.total ? '' : 'neutral'}`}
          >
            Final: {finalScore.correct} / {finalScore.total}
          </span>
        )}
      </div>
    </section>
  </main>
</div>

     
    ); 
}
