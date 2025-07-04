import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

import { ScrollArea } from '@/components/ui/scroll-area'
import { blink } from '@/blink/client'
import { 
  FileText, 
  Sparkles, 
  Download, 
  Eye, 
  Slides, 
  Palette, 
  Users, 
  Building, 
  Lightbulb,
  Loader2,
  CheckCircle,
  Plus,
  Edit3,
  Trash2
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'

interface Slide {
  id: string
  title: string
  content: string
  type: 'title' | 'content' | 'bullet' | 'image' | 'conclusion'
  notes?: string
}

interface Presentation {
  id: string
  title: string
  slides: Slide[]
  theme: string
  createdAt: string
}

function App() {
  const [prompt, setPrompt] = useState('')
  const [title, setTitle] = useState('')
  const [theme, setTheme] = useState('professional')
  const [slideCount, setSlideCount] = useState('8')
  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentPresentation, setCurrentPresentation] = useState<Presentation | null>(null)
  const [presentations, setPresentations] = useState<Presentation[]>([])
  const [selectedSlide, setSelectedSlide] = useState<number>(0)
  const [user, setUser] = useState<{ id: string; email: string } | null>(null)
  const [editingSlide, setEditingSlide] = useState<string | null>(null)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const userData = await blink.auth.me()
        setUser(userData)
        loadPresentations()
      } catch (error) {
        console.error('Auth error:', error)
      }
    }
    checkAuth()
  }, [])

  const loadPresentations = async () => {
    try {
      const savedPresentations = await blink.db.presentations.list({
        where: { user_id: user?.id },
        orderBy: { created_at: 'desc' }
      })
      setPresentations(savedPresentations)
    } catch (error) {
      console.error('Error loading presentations:', error)
    }
  }

  const generatePresentation = async () => {
    if (!prompt.trim() || !title.trim()) {
      toast.error('Please provide both a title and topic description')
      return
    }

    setIsGenerating(true)
    setProgress(0)
    
    try {
      // Progress simulation
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90))
      }, 200)

      const aiPrompt = `Create a ${slideCount}-slide presentation about "${prompt}". 
      Title: "${title}"
      Theme: ${theme}
      
      Return a JSON object with this structure:
      {
        "title": "Presentation Title",
        "slides": [
          {
            "title": "Slide Title",
            "content": "Main content for the slide",
            "type": "title|content|bullet|conclusion",
            "notes": "Speaker notes"
          }
        ]
      }
      
      Make it engaging, professional, and well-structured. Include a title slide, content slides with clear points, and a conclusion slide.`

      const response = await blink.ai.generateText({
        prompt: aiPrompt,
        model: 'gpt-4o-mini'
      })

      clearInterval(progressInterval)
      setProgress(100)

      // Parse the AI response
      let presentationData
      try {
        const jsonMatch = response.text.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          presentationData = JSON.parse(jsonMatch[0])
        } else {
          throw new Error('No JSON found in response')
        }
      } catch {
        // Fallback if JSON parsing fails
        presentationData = createFallbackPresentation()
      }

      const slides: Slide[] = presentationData.slides.map((slide: { title: string; content: string; type?: string; notes?: string }, index: number) => ({
        id: `slide-${index}`,
        title: slide.title,
        content: slide.content,
        type: slide.type || (index === 0 ? 'title' : index === presentationData.slides.length - 1 ? 'conclusion' : 'content'),
        notes: slide.notes || ''
      }))

      const newPresentation: Presentation = {
        id: `pres-${Date.now()}`,
        title: presentationData.title || title,
        slides,
        theme,
        createdAt: new Date().toISOString()
      }

      // Save to database
      if (user) {
        try {
          await blink.db.presentations.create({
            id: newPresentation.id,
            user_id: user.id,
            title: newPresentation.title,
            slides: JSON.stringify(newPresentation.slides),
            theme: newPresentation.theme,
            created_at: newPresentation.createdAt
          })
        } catch (error) {
          console.error('Error saving presentation:', error)
        }
      }

      setCurrentPresentation(newPresentation)
      setPresentations(prev => [newPresentation, ...prev])
      setSelectedSlide(0)
      toast.success('Presentation generated successfully!')

    } catch (error) {
      console.error('Error generating presentation:', error)
      toast.error('Failed to generate presentation. Please try again.')
    } finally {
      setIsGenerating(false)
      setProgress(0)
    }
  }

  const createFallbackPresentation = () => ({
    title: title,
    slides: [
      {
        title: title,
        content: `Welcome to ${title}`,
        type: 'title',
        notes: 'Introduction slide'
      },
      {
        title: 'Overview',
        content: prompt,
        type: 'content', 
        notes: 'Main topic overview'
      },
      {
        title: 'Key Points',
        content: 'Important considerations and insights',
        type: 'bullet',
        notes: 'Highlight main points'
      },
      {
        title: 'Conclusion',
        content: 'Thank you for your attention',
        type: 'conclusion',
        notes: 'Wrap up the presentation'
      }
    ]
  })

  const updateSlide = async (slideId: string, updates: Partial<Slide>) => {
    if (!currentPresentation) return

    const updatedSlides = currentPresentation.slides.map(slide =>
      slide.id === slideId ? { ...slide, ...updates } : slide
    )

    const updatedPresentation = {
      ...currentPresentation,
      slides: updatedSlides
    }

    setCurrentPresentation(updatedPresentation)

    // Update in database
    try {
      await blink.db.presentations.update(currentPresentation.id, {
        slides: JSON.stringify(updatedSlides)
      })
    } catch (error) {
      console.error('Error updating slide:', error)
    }
  }

  const deleteSlide = async (slideId: string) => {
    if (!currentPresentation || currentPresentation.slides.length <= 1) return

    const updatedSlides = currentPresentation.slides.filter(slide => slide.id !== slideId)
    const updatedPresentation = {
      ...currentPresentation,
      slides: updatedSlides
    }

    setCurrentPresentation(updatedPresentation)
    setSelectedSlide(Math.min(selectedSlide, updatedSlides.length - 1))

    try {
      await blink.db.presentations.update(currentPresentation.id, {
        slides: JSON.stringify(updatedSlides)
      })
      toast.success('Slide deleted')
    } catch (error) {
      console.error('Error deleting slide:', error)
    }
  }

  const addSlide = async () => {
    if (!currentPresentation) return

    const newSlide: Slide = {
      id: `slide-${Date.now()}`,
      title: 'New Slide',
      content: 'Add your content here...',
      type: 'content',
      notes: ''
    }

    const updatedSlides = [...currentPresentation.slides, newSlide]
    const updatedPresentation = {
      ...currentPresentation,
      slides: updatedSlides
    }

    setCurrentPresentation(updatedPresentation)
    setSelectedSlide(updatedSlides.length - 1)

    try {
      await blink.db.presentations.update(currentPresentation.id, {
        slides: JSON.stringify(updatedSlides)
      })
      toast.success('New slide added')
    } catch (error) {
      console.error('Error adding slide:', error)
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <Sparkles className="w-16 h-16 mx-auto mb-4 text-indigo-600" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">AI PowerPoint Generator</h1>
          <p className="text-gray-600">Authenticating...</p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <motion.div
                initial={{ rotate: 0 }}
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <Sparkles className="w-8 h-8 text-indigo-600" />
              </motion.div>
              <h1 className="text-xl font-bold text-gray-900">AI PowerPoint Generator</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                Welcome, {user.email}
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="create" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="create" className="flex items-center space-x-2">
              <Plus className="w-4 h-4" />
              <span>Create</span>
            </TabsTrigger>
            <TabsTrigger value="library" className="flex items-center space-x-2">
              <Slides className="w-4 h-4" />
              <span>Library</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Input Panel */}
              <div className="lg:col-span-1">
                <Card className="h-fit">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Lightbulb className="w-5 h-5 text-yellow-500" />
                      <span>Create Presentation</span>
                    </CardTitle>
                    <CardDescription>
                      Tell us what you want to present and we'll generate it for you
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-2 block">
                        Presentation Title
                      </label>
                      <Input
                        placeholder="e.g., Market Analysis 2024"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-2 block">
                        Topic Description
                      </label>
                      <Textarea
                        placeholder="Describe what you want to present about. Include key points, audience, and any specific requirements..."
                        rows={4}
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-2 block">
                          Slides Count
                        </label>
                        <Select value={slideCount} onValueChange={setSlideCount}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="5">5 slides</SelectItem>
                            <SelectItem value="8">8 slides</SelectItem>
                            <SelectItem value="10">10 slides</SelectItem>
                            <SelectItem value="15">15 slides</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-2 block">
                          Theme
                        </label>
                        <Select value={theme} onValueChange={setTheme}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="professional">
                              <div className="flex items-center space-x-2">
                                <Building className="w-4 h-4" />
                                <span>Professional</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="creative">
                              <div className="flex items-center space-x-2">
                                <Palette className="w-4 h-4" />
                                <span>Creative</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="minimal">
                              <div className="flex items-center space-x-2">
                                <Users className="w-4 h-4" />
                                <span>Minimal</span>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {isGenerating && (
                      <div className="space-y-3">
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Generating your presentation...</span>
                        </div>
                        <Progress value={progress} className="w-full" />
                      </div>
                    )}

                    <Button 
                      onClick={generatePresentation}
                      disabled={isGenerating || !prompt.trim() || !title.trim()}
                      className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          Generate Presentation
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Preview Panel */}
              <div className="lg:col-span-2">
                {currentPresentation ? (
                  <div className="space-y-4">
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="flex items-center space-x-2">
                            <Eye className="w-5 h-5 text-blue-500" />
                            <span>{currentPresentation.title}</span>
                          </CardTitle>
                          <div className="flex items-center space-x-2">
                            <Button variant="outline" size="sm" onClick={addSlide}>
                              <Plus className="w-4 h-4 mr-1" />
                              Add Slide
                            </Button>
                            <Button variant="outline" size="sm">
                              <Download className="w-4 h-4 mr-1" />
                              Export
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>

                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                      {/* Slide Thumbnails */}
                      <div className="lg:col-span-1">
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Slides</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <ScrollArea className="h-96">
                              <div className="space-y-2">
                                {currentPresentation.slides.map((slide, index) => (
                                  <motion.div
                                    key={slide.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.1 }}
                                  >
                                    <div 
                                      className={`p-3 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
                                        selectedSlide === index 
                                          ? 'border-indigo-500 bg-indigo-50' 
                                          : 'border-gray-200 hover:border-gray-300'
                                      }`}
                                      onClick={() => setSelectedSlide(index)}
                                    >
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-medium text-gray-500">
                                          Slide {index + 1}
                                        </span>
                                        <div className="flex items-center space-x-1">
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 w-6 p-0"
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              setEditingSlide(slide.id)
                                            }}
                                          >
                                            <Edit3 className="w-3 h-3" />
                                          </Button>
                                          {currentPresentation.slides.length > 1 && (
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                deleteSlide(slide.id)
                                              }}
                                            >
                                              <Trash2 className="w-3 h-3" />
                                            </Button>
                                          )}
                                        </div>
                                      </div>
                                      <h4 className="text-sm font-medium text-gray-900 truncate">
                                        {slide.title}
                                      </h4>
                                      <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                                        {slide.content}
                                      </p>
                                    </div>
                                  </motion.div>
                                ))}
                              </div>
                            </ScrollArea>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Main Slide View */}
                      <div className="lg:col-span-3">
                        <Card className="h-96">
                          <CardContent className="p-0 h-full">
                            <AnimatePresence mode="wait">
                              <motion.div
                                key={selectedSlide}
                                initial={{ opacity: 0, x: 100 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -100 }}
                                transition={{ duration: 0.3 }}
                                className="h-full p-8 flex flex-col justify-center relative"
                                style={{
                                  background: theme === 'professional' 
                                    ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                                    : theme === 'creative'
                                    ? 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
                                    : 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
                                }}
                              >
                                {currentPresentation.slides[selectedSlide] && (
                                  <div className="text-white">
                                    {editingSlide === currentPresentation.slides[selectedSlide].id ? (
                                      <div className="space-y-4">
                                        <Input
                                          value={currentPresentation.slides[selectedSlide].title}
                                          onChange={(e) => updateSlide(currentPresentation.slides[selectedSlide].id, { title: e.target.value })}
                                          className="text-2xl font-bold bg-white/10 border-white/20 text-white placeholder-white/70"
                                          placeholder="Slide title"
                                        />
                                        <Textarea
                                          value={currentPresentation.slides[selectedSlide].content}
                                          onChange={(e) => updateSlide(currentPresentation.slides[selectedSlide].id, { content: e.target.value })}
                                          className="bg-white/10 border-white/20 text-white placeholder-white/70"
                                          placeholder="Slide content"
                                          rows={6}
                                        />
                                        <div className="flex space-x-2">
                                          <Button 
                                            size="sm" 
                                            onClick={() => setEditingSlide(null)}
                                            className="bg-white/20 hover:bg-white/30"
                                          >
                                            <CheckCircle className="w-4 h-4 mr-1" />
                                            Done
                                          </Button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="space-y-4">
                                        <h2 className="text-3xl font-bold leading-tight">
                                          {currentPresentation.slides[selectedSlide].title}
                                        </h2>
                                        <div className="text-lg leading-relaxed">
                                          {currentPresentation.slides[selectedSlide].content.split('\n').map((line, i) => (
                                            <p key={i} className="mb-2">{line}</p>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Slide Navigation */}
                                <div className="absolute bottom-4 right-4 flex space-x-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={selectedSlide === 0}
                                    onClick={() => setSelectedSlide(Math.max(0, selectedSlide - 1))}
                                    className="bg-white/20 hover:bg-white/30 text-white"
                                  >
                                    Previous
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={selectedSlide === currentPresentation.slides.length - 1}
                                    onClick={() => setSelectedSlide(Math.min(currentPresentation.slides.length - 1, selectedSlide + 1))}
                                    className="bg-white/20 hover:bg-white/30 text-white"
                                  >
                                    Next
                                  </Button>
                                </div>

                                {/* Slide Counter */}
                                <div className="absolute bottom-4 left-4 text-white/80 text-sm">
                                  {selectedSlide + 1} / {currentPresentation.slides.length}
                                </div>
                              </motion.div>
                            </AnimatePresence>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  </div>
                ) : (
                  <Card className="h-96">
                    <CardContent className="h-full flex items-center justify-center">
                      <div className="text-center text-gray-500">
                        <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                        <p className="text-lg font-medium">No presentation selected</p>
                        <p className="text-sm">Create a new presentation to get started</p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="library">
            <Card>
              <CardHeader>
                <CardTitle>Your Presentations</CardTitle>
                <CardDescription>
                  Manage and view all your created presentations
                </CardDescription>
              </CardHeader>
              <CardContent>
                {presentations.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {presentations.map((presentation, index) => (
                      <motion.div
                        key={presentation.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                      >
                        <Card className="cursor-pointer hover:shadow-lg transition-shadow">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-3">
                              <Badge variant="outline" className="text-xs">
                                {presentation.slides.length} slides
                              </Badge>
                              <span className="text-xs text-gray-500">
                                {new Date(presentation.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">
                              {presentation.title}
                            </h3>
                            <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                              {presentation.slides[0]?.content || 'No content'}
                            </p>
                            <div className="flex space-x-2">
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="flex-1"
                                onClick={() => {
                                  setCurrentPresentation(presentation)
                                  setSelectedSlide(0)
                                }}
                              >
                                <Eye className="w-4 h-4 mr-1" />
                                View
                              </Button>
                              <Button size="sm" variant="outline">
                                <Download className="w-4 h-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <Slides className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg font-medium">No presentations yet</p>
                    <p className="text-sm">Create your first presentation to get started</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default App