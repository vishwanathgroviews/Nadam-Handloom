// Add or edit a category (owners): name, description, photo, all in one go.
// The web address is made from the first name and kept when renamed (decision 5.8).
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen, TopBar } from '../../../../components/Screen';
import { Button } from '../../../../components/Button';
import { Banner } from '../../../../components/Banner';
import { TextField } from '../../../../components/TextField';
import { useFeedback } from '../../../../components/Feedback';
import { PhotoField } from '../../../../components/catalog/PhotoField';
import { OwnersOnly } from '../../../../components/team/OwnersOnly';
import { useTabBarSpace } from '../../../../hooks/useTabBarSpace';
import * as catalog from '../../../../api/catalog';
import { categoryFormErrors } from '../../../../utils/catalog';

export default function CategoryForm() {
  const { id } = useLocalSearchParams();
  const editing = !!id;
  const { showToast } = useFeedback();
  const tabSpace = useTabBarSpace().footer;
  const [loaded, setLoaded] = useState(!editing);
  const [current, setCurrent] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState(null);
  const [errors, setErrors] = useState({});
  const [problem, setProblem] = useState(null);
  const [savedId, setSavedId] = useState(null); // details saved but the photo failed
  const [busy, setBusy] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    if (!editing) return;
    catalog.getCategory(id).then((d) => {
      setCurrent(d.category);
      setName(d.category.name);
      setDescription(d.category.description);
      setLoaded(true);
    }, (e) => setProblem(e));
  }, [editing, id]);

  async function save() {
    const e = categoryFormErrors({ name, description });
    setErrors(e);
    setProblem(null);
    if (Object.keys(e).length) return;
    setBusy(true);
    let catId = savedId || id;
    try {
      if (!savedId) {
        const body = { name: name.trim().replace(/\s+/g, ' '), description: description.trim() };
        const r = editing ? await catalog.updateCategory(id, body) : await catalog.createCategory(body);
        catId = r.category.id;
      }
      if (photo) {
        try {
          await catalog.uploadPhoto('category', catId, photo);
        } catch (err) {
          setSavedId(catId);
          setProblem({ message: `The details are saved, but the photo didn't upload: ${err.message} Press Save to try the photo again.` });
          return;
        }
      }
      if (editing) router.back();
      else router.replace(`/more/catalogue/category/${catId}`);
      showToast(editing ? 'Saved' : `${name.trim()} added`, 'success');
    } catch (err) {
      if (err.code === 'FORBIDDEN') setForbidden(true);
      else if (err.code === 'NAME_TAKEN') setErrors({ name: err.message });
      else if (err.code === 'VALIDATION_FAILED') setErrors({ [err.details?.issues?.[0]?.field === 'description' ? 'description' : 'name']: err.message });
      else setProblem(err);
    } finally {
      setBusy(false);
    }
  }

  if (forbidden) return <OwnersOnly />;
  return (
    <Screen edges={['top']} top={<TopBar title={editing ? 'Edit category' : 'New category'} onBack={() => router.back()} />} maxWidth={640}
      footer={<View style={{ paddingBottom: tabSpace }}><Button title={editing ? 'Save' : 'Add category'} loading={busy} disabled={!loaded} onPress={save} /></View>}>
      {problem ? <Banner tone={problem.code === 'NETWORK' || problem.code === 'TIMEOUT' ? 'warning' : 'error'} title="Couldn't save" text={problem.message} style={{ marginBottom: 14 }} /> : null}
      <TextField label="Name" nativeID="cat-name" value={name} onChange={setName} error={errors.name} placeholder="e.g. Handloom Silk Sarees" maxLength={100} autoCapitalize="words"
        hint={current ? `The web address stays /${current.slug} even if you rename it.` : undefined} />
      <TextField label="Description" nativeID="cat-desc" value={description} onChange={setDescription} error={errors.description} placeholder="What customers should know about this category" maxLength={2000} multiline hint="The website shows this." />
      <PhotoField shape="card" currentUrl={current?.imageUrl} stagedUri={photo} onStaged={setPhoto} />
    </Screen>
  );
}
